package com.xiaoying.studio.task;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import com.xiaoying.studio.auth.AuthInterceptor;
import com.xiaoying.studio.common.ApiException;
import com.xiaoying.studio.common.StorageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 除提交接口外都是只读查询，不会触发或推进任务。 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private static final int MAX_BATCH_IDS = 100;

    public record CreateTaskRequest(@NotBlank(message = "缺少模板") String templateId,
                                    @NotEmpty(message = "缺少素材") List<@NotBlank String> assetIds) {
    }

    public record TaskResponse(String id, String templateId, String templateTitle, String templateCoverUrl,
                               TaskStatus status, StageName currentStage, StageName failureStage,
                               String failureReason, String resultUrl, Instant createdAt, Instant updatedAt,
                               Instant finishedAt) {
        static TaskResponse of(Task t) {
            String resultUrl = t.getResultPath() == null ? null : "/api/tasks/" + t.getId() + "/result";
            return new TaskResponse(t.getId(), t.getTemplateId(), t.getTemplateTitle(), t.getTemplateCoverUrl(),
                    t.getStatus(), t.getCurrentStage(), t.getFailureStage(), t.getFailureReason(), resultUrl,
                    t.getCreatedAt(), t.getUpdatedAt(), t.getFinishedAt());
        }
    }

    public record TaskDetailResponse(TaskResponse task, List<TaskStageRun> stages) {
    }

    private final TaskService taskService;
    private final TaskMapper taskMapper;
    private final StorageService storageService;

    public TaskController(TaskService taskService, TaskMapper taskMapper, StorageService storageService) {
        this.taskService = taskService;
        this.taskMapper = taskMapper;
        this.storageService = storageService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public TaskResponse create(HttpServletRequest request, @Valid @RequestBody CreateTaskRequest body) {
        String userId = AuthInterceptor.currentUser(request).getId();
        return TaskResponse.of(taskService.create(userId, body.templateId(), body.assetIds()));
    }

    @GetMapping
    public List<TaskResponse> list(HttpServletRequest request, @RequestParam(required = false) String templateId) {
        String userId = AuthInterceptor.currentUser(request).getId();
        return taskService.list(userId, templateId).stream().map(TaskResponse::of).toList();
    }

    /** 前端轮询使用：一次查询多个任务。不属于当前用户的 ID 会被忽略。 */
    @GetMapping("/batch")
    public List<TaskResponse> batch(HttpServletRequest request, @RequestParam String ids) {
        String userId = AuthInterceptor.currentUser(request).getId();
        List<String> taskIds = Arrays.stream(ids.split(",")).filter(id -> !id.isBlank()).distinct().toList();
        if (taskIds.isEmpty()) {
            return List.of();
        }
        if (taskIds.size() > MAX_BATCH_IDS) {
            throw ApiException.badRequest("TOO_MANY_IDS", "一次最多查询 " + MAX_BATCH_IDS + " 个任务");
        }
        return taskMapper.findOwnedByIds(userId, taskIds).stream().map(TaskResponse::of).toList();
    }

    @GetMapping("/{id}")
    public TaskDetailResponse detail(HttpServletRequest request, @PathVariable String id) {
        String userId = AuthInterceptor.currentUser(request).getId();
        Task task = taskService.getOwned(userId, id);
        return new TaskDetailResponse(TaskResponse.of(task), taskMapper.findStageRuns(id));
    }

    @GetMapping("/{id}/result")
    public ResponseEntity<Resource> result(HttpServletRequest request, @PathVariable String id) {
        String userId = AuthInterceptor.currentUser(request).getId();
        Task task = taskService.getOwned(userId, id);
        if (task.getResultPath() == null) {
            throw ApiException.notFound("RESULT_NOT_READY", "结果尚未生成");
        }
        Path file = storageService.resolve(task.getResultPath());
        if (!Files.isRegularFile(file)) {
            throw ApiException.notFound("RESULT_NOT_FOUND", "结果文件不存在");
        }
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(new FileSystemResource(file));
    }
}
