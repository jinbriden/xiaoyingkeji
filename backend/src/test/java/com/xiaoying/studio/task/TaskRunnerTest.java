package com.xiaoying.studio.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import com.xiaoying.studio.task.stage.StageContext;
import com.xiaoying.studio.task.stage.TaskStage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InOrder;

class TaskRunnerTest {

    private static final String TASK_ID = "task-1";

    private final TaskMapper taskMapper = mock(TaskMapper.class);
    private final List<StageName> executed = new ArrayList<>();
    private final Task task = new Task();

    private TaskRunner runner;

    @BeforeEach
    void setUp() {
        task.setId(TASK_ID);
        when(taskMapper.findById(TASK_ID)).thenReturn(task);
        // 故意乱序注入，验证执行顺序由阶段定义决定
        runner = new TaskRunner(taskMapper, new StageDelay(), List.of(
                stage(StageName.RESULT), stage(StageName.ASSET_CHECK), stage(StageName.GENERATE)));
    }

    private TaskStage stage(StageName name) {
        return new TaskStage() {
            @Override
            public StageName name() {
                return name;
            }

            @Override
            public void execute(StageContext context) {
                executed.add(name);
                if (name == StageName.RESULT) {
                    context.setResultPath("results/task-1.png");
                }
            }
        };
    }

    @Test
    void runsStagesInOrderAndRecordsEachBoundary() {
        runner.run(TASK_ID);

        assertThat(executed).containsExactly(StageName.ASSET_CHECK, StageName.GENERATE, StageName.RESULT);

        InOrder order = inOrder(taskMapper);
        for (StageName name : StageName.values()) {
            order.verify(taskMapper).updateStage(eq(TASK_ID), eq(name), any());
            order.verify(taskMapper).insertStageRun(eq(TASK_ID), eq(name), any());
            order.verify(taskMapper).finishStageRun(eq(TASK_ID), eq(name), eq("SUCCEEDED"), any(), any());
        }
        order.verify(taskMapper).markSucceeded(eq(TASK_ID), eq("results/task-1.png"), any());
        verify(taskMapper, never()).markFailed(anyString(), any(), anyString(), any());
    }

    @ParameterizedTest
    @EnumSource(StageName.class)
    void stopsLaterStagesWhenSpecifiedStageFails(StageName failStage) {
        task.setSimFailStage(failStage);

        runner.run(TASK_ID);

        List<StageName> expected = List.of(StageName.values()).subList(0, failStage.ordinal());
        assertThat(executed).containsExactlyElementsOf(expected);
        verify(taskMapper).markFailed(eq(TASK_ID), eq(failStage), eq(failStage.label() + "未通过（模拟失败）"), any());
        verify(taskMapper).finishStageRun(eq(TASK_ID), eq(failStage), eq("FAILED"), any(), any());
        verify(taskMapper, never()).markSucceeded(anyString(), any(), any());
        for (StageName later : StageName.values()) {
            if (later.ordinal() > failStage.ordinal()) {
                verify(taskMapper, never()).updateStage(eq(TASK_ID), eq(later), any());
            }
        }
    }

    @Test
    void unexpectedStageErrorBecomesReadableFailure() {
        TaskRunner crashing = new TaskRunner(taskMapper, new StageDelay(), List.of(new TaskStage() {
            @Override
            public StageName name() {
                return StageName.ASSET_CHECK;
            }

            @Override
            public void execute(StageContext context) {
                throw new IllegalStateException("disk gone");
            }
        }));

        crashing.run(TASK_ID);

        verify(taskMapper).markFailed(eq(TASK_ID), eq(StageName.ASSET_CHECK), eq("素材检查时发生内部错误"), any());
    }
}
