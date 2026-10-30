package com.xiaoying.studio.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** 走完整链路：接口提交 → 调度器领取 → 三阶段执行 → 读取结果图片。 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskExecutionIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper json;

    private ApiTestSupport api;
    private Cookie session;

    @BeforeEach
    void setUp() throws Exception {
        api = new ApiTestSupport(mvc, json);
        session = api.register();
    }

    @AfterEach
    void resetSimulation() throws Exception {
        configure(null);
    }

    private void configure(String failStage) throws Exception {
        String value = failStage == null ? "null" : "\"" + failStage + "\"";
        mvc.perform(put("/api/dev/simulation").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetCheckDelayMs\":0,\"generateDelayMs\":0,\"resultDelayMs\":0,\"failStage\":" + value + "}"))
                .andExpect(status().isOk());
    }

    private String submit() throws Exception {
        String assetId = api.upload(session, "demo-poster");
        return api.read(mvc.perform(post("/api/tasks").cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"demo-poster\",\"assetIds\":[\"" + assetId + "\"]}"))
                .andExpect(status().isAccepted())
                .andReturn()).get("id").asText();
    }

    private JsonNode awaitTerminal(String taskId) throws Exception {
        long deadline = System.currentTimeMillis() + 10_000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode detail = api.read(mvc.perform(get("/api/tasks/" + taskId).cookie(session)).andReturn());
            String status = detail.get("task").get("status").asText();
            if ("SUCCEEDED".equals(status) || "FAILED".equals(status)) {
                return detail;
            }
            Thread.sleep(20);
        }
        throw new AssertionError("Task did not finish: " + taskId);
    }

    private static List<String> stageNames(JsonNode detail) {
        List<String> names = new ArrayList<>();
        detail.get("stages").forEach(stage -> names.add(stage.get("stage").asText()));
        return names;
    }

    @Test
    void completesAllStagesAndServesResultImage() throws Exception {
        String taskId = submit();

        JsonNode detail = awaitTerminal(taskId);

        assertThat(detail.get("task").get("status").asText()).isEqualTo("SUCCEEDED");
        assertThat(stageNames(detail)).containsExactlyInAnyOrder("ASSET_CHECK", "GENERATE", "RESULT");
        String resultUrl = detail.get("task").get("resultUrl").asText();
        mvc.perform(get(resultUrl).cookie(session))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));
    }

    @Test
    void specifiedStageFailureIsPersistedAndStopsExecution() throws Exception {
        configure("GENERATE");
        String taskId = submit();

        JsonNode detail = awaitTerminal(taskId);

        JsonNode task = detail.get("task");
        assertThat(task.get("status").asText()).isEqualTo("FAILED");
        assertThat(task.get("failureStage").asText()).isEqualTo("GENERATE");
        assertThat(task.get("failureReason").asText()).isEqualTo("模拟生成未通过（模拟失败）");
        assertThat(task.get("resultUrl").isNull()).isTrue();
        assertThat(stageNames(detail)).containsExactlyInAnyOrder("ASSET_CHECK", "GENERATE");
    }

    @Test
    void settingsAreFixedWhenTaskIsAccepted() throws Exception {
        String healthy = submit();
        configure("ASSET_CHECK");
        String failing = submit();
        configure(null);

        assertThat(awaitTerminal(healthy).get("task").get("status").asText()).isEqualTo("SUCCEEDED");
        assertThat(awaitTerminal(failing).get("task").get("status").asText()).isEqualTo("FAILED");
    }
}
