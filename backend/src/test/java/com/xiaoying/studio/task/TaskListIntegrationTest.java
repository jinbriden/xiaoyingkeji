package com.xiaoying.studio.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "app.task.dispatcher-enabled=false",
        "spring.datasource.url=jdbc:h2:mem:studio_query;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskListIntegrationTest {

    private static final Instant OLD = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant RECENT = OLD.plusSeconds(3600);

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiTestSupport api;
    private Cookie session;
    private String userId;

    @BeforeEach
    void setUp() throws Exception {
        api = new ApiTestSupport(mvc, json);
        session = api.register();
        userId = ownerId(session);
    }

    private String ownerId(Cookie owner) throws Exception {
        return api.read(mvc.perform(get("/api/auth/me").cookie(owner))
                .andExpect(status().isOk()).andReturn()).get("id").asText();
    }

    private String insert(String owner, String template, String state, Instant createdAt) {
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO task (id, user_id, template_id, status, sim_asset_check_ms, "
                        + "sim_generate_ms, sim_result_ms, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)",
                id, owner, template, state, Timestamp.from(createdAt), Timestamp.from(createdAt));
        return id;
    }

    private List<String> ids(JsonNode tasks) {
        assertThat(tasks.isArray()).isTrue();
        List<String> ids = new ArrayList<>();
        tasks.forEach(task -> ids.add(task.get("id").asText()));
        return ids;
    }

    @Test
    void returnsAllHundredAndOneActiveTasksWithoutDuplicates() throws Exception {
        List<String> expected = new ArrayList<>();
        for (int i = 0; i < 101; i++) {
            expected.add(insert(userId, "demo-poster", i % 2 == 0 ? "PENDING" : "PROCESSING", OLD));
        }
        expected.sort(String::compareTo);

        JsonNode tasks = api.read(mvc.perform(get("/api/tasks").cookie(session))
                .andExpect(status().isOk()).andReturn());

        assertThat(ids(tasks)).containsExactlyElementsOf(expected).doesNotHaveDuplicates();
    }

    @Test
    void terminalOnlyHistoryStillStopsAtHundredNewestRecords() throws Exception {
        List<String> expected = new ArrayList<>();
        for (int i = 0; i < 105; i++) {
            String id = insert(userId, "demo-poster", i % 2 == 0 ? "SUCCEEDED" : "FAILED", OLD.plusSeconds(i));
            if (i >= 5) {
                expected.add(0, id);
            }
        }

        JsonNode tasks = api.read(mvc.perform(get("/api/tasks").cookie(session))
                .andExpect(status().isOk()).andReturn());

        assertThat(ids(tasks)).containsExactlyElementsOf(expected);
    }

    @Test
    void templateFilterAndUserIsolationApplyToBothHistoryAndActiveTasks() throws Exception {
        String oldActive = insert(userId, "demo-poster", "PROCESSING", OLD);
        String differentTemplate = insert(userId, "demo-postcard", "PENDING", OLD);
        insert(userId, "demo-postcard", "SUCCEEDED", RECENT.plusSeconds(1));
        List<String> history = new ArrayList<>();
        for (int i = 0; i < 105; i++) {
            history.add(insert(userId, "demo-poster", "SUCCEEDED", RECENT));
        }
        Cookie other = api.register();
        String otherId = ownerId(other);
        insert(otherId, "demo-poster", "PENDING", OLD);
        insert(otherId, "demo-poster", "PROCESSING", OLD);
        insert(otherId, "demo-poster", "SUCCEEDED", RECENT.plusSeconds(2));
        history.sort(String::compareTo);
        List<String> expected = new ArrayList<>(history.subList(0, 100));
        expected.add(oldActive);

        JsonNode tasks = api.read(mvc.perform(get("/api/tasks").param("templateId", "demo-poster").cookie(session))
                .andExpect(status().isOk()).andReturn());
        assertThat(ids(tasks)).containsExactlyElementsOf(expected).doesNotContain(differentTemplate);

        JsonNode unfiltered = api.read(mvc.perform(get("/api/tasks").cookie(session))
                .andExpect(status().isOk()).andReturn());
        assertThat(ids(unfiltered)).hasSize(102).contains(oldActive, differentTemplate);
        assertThat(ids(api.read(mvc.perform(get("/api/tasks")
                        .param("templateId", "demo-poster' OR '1'='1").cookie(session))
                .andExpect(status().isOk()).andReturn()))).isEmpty();
    }

    @Test
    void oldActiveTasksRemainVisibleBeyondTheLatestHundredHistoryRecords() throws Exception {
        String pending = insert(userId, "demo-poster", "PENDING", OLD);
        String processing = insert(userId, "demo-poster", "PROCESSING", OLD);
        List<String> history = new ArrayList<>();
        for (int i = 0; i < 105; i++) {
            history.add(insert(userId, "demo-poster", i % 2 == 0 ? "SUCCEEDED" : "FAILED", RECENT));
        }
        history.sort(String::compareTo);
        List<String> expected = new ArrayList<>(history.subList(0, 100));
        expected.addAll(List.of(pending, processing).stream().sorted().toList());

        JsonNode tasks = api.read(mvc.perform(get("/api/tasks").cookie(session))
                .andExpect(status().isOk()).andReturn());

        assertThat(ids(tasks)).containsExactlyElementsOf(expected);
        assertThat(tasks.findValuesAsText("status")).contains("PENDING", "PROCESSING");
    }
}
