package com.xiaoying.studio.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** 关闭调度器后验证：任务不会被任何接口推进，校验和用户隔离在接口层生效。 */
@SpringBootTest(properties = {
        "app.task.dispatcher-enabled=false",
        // 独立数据库：另一测试类的调度器在缓存的上下文中持续运行，不能共享任务表
        "spring.datasource.url=jdbc:h2:mem:studio_query;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskQueryIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper json;
    @Autowired
    private TaskMapper taskMapper;

    private ApiTestSupport api;
    private Cookie session;

    @BeforeEach
    void setUp() throws Exception {
        api = new ApiTestSupport(mvc, json);
        session = api.register();
    }

    private String submit(Cookie owner) throws Exception {
        String assetId = api.upload(owner, "demo-poster");
        return api.read(mvc.perform(post("/api/tasks").cookie(owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"demo-poster\",\"assetIds\":[\"" + assetId + "\"]}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn()).get("id").asText();
    }

    @Test
    void queriesNeverAdvanceTask() throws Exception {
        String taskId = submit(session);

        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/api/tasks/" + taskId).cookie(session)).andExpect(status().isOk());
            mvc.perform(get("/api/tasks/batch").param("ids", taskId).cookie(session)).andExpect(status().isOk());
            mvc.perform(get("/api/tasks").cookie(session)).andExpect(status().isOk());
        }

        assertThat(taskMapper.findById(taskId).getStatus()).isEqualTo(TaskStatus.PENDING);
    }

    @Test
    void terminalStateCannotBeOverwritten() throws Exception {
        String taskId = submit(session);
        assertThat(taskMapper.claim(taskId, Instant.now())).isEqualTo(1);
        assertThat(taskMapper.markSucceeded(taskId, "results/x.png", Instant.now())).isEqualTo(1);

        assertThat(taskMapper.claim(taskId, Instant.now())).isZero();
        assertThat(taskMapper.updateStage(taskId, StageName.GENERATE, Instant.now())).isZero();
        assertThat(taskMapper.markFailed(taskId, StageName.GENERATE, "late", Instant.now())).isZero();
        assertThat(taskMapper.findById(taskId).getStatus()).isEqualTo(TaskStatus.SUCCEEDED);
    }

    @Test
    void interruptedTasksFailWithReasonAndKeepStage() throws Exception {
        String taskId = submit(session);
        taskMapper.claim(taskId, Instant.now());
        taskMapper.updateStage(taskId, StageName.GENERATE, Instant.now());

        taskMapper.failInterrupted("服务重启", Instant.now());

        Task task = taskMapper.findById(taskId);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(task.getFailureStage()).isEqualTo(StageName.GENERATE);
    }

    @Test
    void otherUsersCannotSeeOrUseRecords() throws Exception {
        String taskId = submit(session);
        Cookie other = api.register();

        mvc.perform(get("/api/tasks/" + taskId).cookie(other)).andExpect(status().isNotFound());
        mvc.perform(get("/api/tasks/" + taskId + "/result").cookie(other)).andExpect(status().isNotFound());
        mvc.perform(get("/api/tasks").cookie(other)).andExpect(jsonPath("$.length()").value(0));
        JsonNode batch = api.read(mvc.perform(get("/api/tasks/batch").param("ids", taskId).cookie(other)).andReturn());
        assertThat(batch).isEmpty();

        String assetId = api.upload(session, "demo-poster");
        mvc.perform(post("/api/tasks").cookie(other)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"demo-poster\",\"assetIds\":[\"" + assetId + "\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ASSET_NOT_FOUND"));
    }

    @Test
    void anonymousRequestsAreRejected() throws Exception {
        mvc.perform(get("/api/tasks")).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsWrongAssetCountAndUnknownTemplate() throws Exception {
        String assetId = api.upload(session, "demo-postcard");
        mvc.perform(post("/api/tasks").cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"demo-postcard\",\"assetIds\":[\"" + assetId + "\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ASSET_COUNT"));
        mvc.perform(post("/api/tasks").cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"missing\",\"assetIds\":[\"" + assetId + "\"]}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void missingUploadTemplateIdIsInvalidArgument() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", ApiTestSupport.png());
        mvc.perform(multipart("/api/assets").file(file).cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"));
    }

    @Test
    void missingBatchIdsIsInvalidArgument() throws Exception {
        mvc.perform(get("/api/tasks/batch").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"));
    }

    @Test
    void rejectsFileWhoseContentIsNotAnImage() throws Exception {
        MockMultipartFile fake = new MockMultipartFile("file", "fake.png", "image/png", "not an image".getBytes());
        mvc.perform(multipart("/api/assets").file(fake).param("templateId", "demo-poster").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
    }

    @Test
    void servesTemplatesAndCategoryFilter() throws Exception {
        mvc.perform(get("/api/template-categories")).andExpect(jsonPath("$[0]").value("创意图片"));
        mvc.perform(get("/api/templates").param("category", "萌宠乐园"))
                .andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/templates/demo-postcard"))
                .andExpect(jsonPath("$.requiredImageCount").value(2))
                .andExpect(jsonPath("$.acceptedMimeTypes[0]").value("image/jpeg"));
        mvc.perform(get("/api/templates/missing")).andExpect(status().isNotFound());
    }
}
