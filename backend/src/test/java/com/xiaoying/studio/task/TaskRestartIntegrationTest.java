package com.xiaoying.studio.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = {
        "app.task.dispatcher-enabled=false",
        "spring.datasource.url=jdbc:h2:mem:studio_restart;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1"
})
@ActiveProfiles("test")
class TaskRestartIntegrationTest {

    private static final Instant STARTED = Instant.parse("2026-01-01T00:00:00Z");

    @Autowired private TaskMapper mapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private TaskRunner runner;
    @Autowired private TaskService service;

    private String userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO app_user (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                userId, userId + "@example.com", "test-only", Timestamp.from(STARTED));
    }

    private String task(String state) {
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO task (id, user_id, template_id, status, current_stage, sim_asset_check_ms, "
                        + "sim_generate_ms, sim_result_ms, created_at, updated_at) "
                        + "VALUES (?, ?, 'demo-poster', ?, 'GENERATE', 0, 0, 0, ?, ?)",
                id, userId, state, Timestamp.from(STARTED), Timestamp.from(STARTED));
        return id;
    }

    private void restart() {
        // Exercise the real startup hook without registering a live scheduler.
        TaskDispatcher dispatcher = new TaskDispatcher(mapper, runner, service, 1);
        try {
            dispatcher.failInterruptedTasks();
        } finally {
            dispatcher.shutdown();
        }
    }

    @Test
    void restartRollsBackStageChangesIfTaskFailureCannotBePersisted() {
        String interrupted = task("PROCESSING");
        mapper.insertStageRun(interrupted, StageName.GENERATE, STARTED);
        // A real database failure on the second write proves the transaction covers both writes.
        jdbc.execute("ALTER TABLE task ADD CONSTRAINT test_reject_restart_failure CHECK (id <> '"
                + interrupted + "' OR status <> 'FAILED')");
        try {
            assertThatThrownBy(this::restart).isInstanceOf(DataIntegrityViolationException.class);
            assertThat(mapper.findById(interrupted).getStatus()).isEqualTo(TaskStatus.PROCESSING);
            assertThat(mapper.findById(interrupted).getFinishedAt()).isNull();
            assertThat(mapper.findStageRuns(interrupted)).singleElement().satisfies(stage -> {
                assertThat(stage.getStatus()).isEqualTo("RUNNING");
                assertThat(stage.getMessage()).isNull();
                assertThat(stage.getFinishedAt()).isNull();
            });
        } finally {
            jdbc.execute("ALTER TABLE task DROP CONSTRAINT test_reject_restart_failure");
        }
    }

    @Test
    void restartClosesOnlyRunningStagesOfInterruptedProcessingTasks() {
        String interrupted = task("PROCESSING");
        mapper.insertStageRun(interrupted, StageName.ASSET_CHECK, STARTED);
        mapper.finishStageRun(interrupted, StageName.ASSET_CHECK, "SUCCEEDED", "checked", STARTED);
        mapper.insertStageRun(interrupted, StageName.GENERATE, STARTED);
        String pending = task("PENDING");
        String succeeded = task("SUCCEEDED");
        String failed = task("FAILED");
        for (String id : new String[]{pending, succeeded, failed}) {
            mapper.insertStageRun(id, StageName.GENERATE, STARTED);
        }
        String beforeStage = task("PROCESSING");
        jdbc.update("UPDATE task SET current_stage = NULL WHERE id = ?", beforeStage);

        restart();

        Task task = mapper.findById(interrupted);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(task.getFailureStage()).isEqualTo(StageName.GENERATE);
        assertThat(task.getCurrentStage()).isNull();
        assertThat(task.getFailureReason()).isEqualTo("服务重启，任务已中断，请重新提交");
        assertThat(task.getFinishedAt()).isNotNull();
        TaskStageRun running = mapper.findStageRuns(interrupted).stream()
                .filter(stage -> stage.getStage() == StageName.GENERATE).findFirst().orElseThrow();
        assertThat(running.getStatus()).isEqualTo("FAILED");
        assertThat(running.getMessage()).isEqualTo(task.getFailureReason());
        assertThat(running.getFinishedAt()).isEqualTo(task.getFinishedAt());
        TaskStageRun completed = mapper.findStageRuns(interrupted).stream()
                .filter(stage -> stage.getStage() == StageName.ASSET_CHECK).findFirst().orElseThrow();
        assertThat(completed.getStatus()).isEqualTo("SUCCEEDED");
        assertThat(completed.getMessage()).isEqualTo("checked");
        assertThat(completed.getFinishedAt()).isEqualTo(STARTED);
        for (String id : new String[]{pending, succeeded, failed}) {
            assertThat(mapper.findStageRuns(id)).singleElement().satisfies(stage -> {
                assertThat(stage.getStatus()).isEqualTo("RUNNING");
                assertThat(stage.getMessage()).isNull();
                assertThat(stage.getFinishedAt()).isNull();
            });
        }
        assertThat(mapper.findById(pending).getStatus()).isEqualTo(TaskStatus.PENDING);
        assertThat(mapper.findById(succeeded).getStatus()).isEqualTo(TaskStatus.SUCCEEDED);
        assertThat(mapper.findById(failed).getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(mapper.findById(beforeStage).getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(mapper.findStageRuns(beforeStage)).isEmpty();

        Instant finishedAt = running.getFinishedAt();
        restart();
        assertThat(mapper.findStageRuns(interrupted).stream()
                .filter(stage -> stage.getStage() == StageName.GENERATE).findFirst().orElseThrow().getFinishedAt())
                .isEqualTo(finishedAt);
    }
}
