package com.xiaoying.studio.task;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.xiaoying.studio.asset.Asset;
import com.xiaoying.studio.asset.AssetMapper;
import com.xiaoying.studio.common.ApiException;
import com.xiaoying.studio.template.Template;
import com.xiaoying.studio.template.TemplateMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 任务受理和查询。这里只读写记录，阶段推进全部由 {@link TaskRunner} 完成。 */
@Service
public class TaskService {

    private final TaskMapper taskMapper;
    private final AssetMapper assetMapper;
    private final TemplateMapper templateMapper;
    private final SimulationSettings simulationSettings;

    public TaskService(TaskMapper taskMapper, AssetMapper assetMapper, TemplateMapper templateMapper,
                       SimulationSettings simulationSettings) {
        this.taskMapper = taskMapper;
        this.assetMapper = assetMapper;
        this.templateMapper = templateMapper;
        this.simulationSettings = simulationSettings;
    }

    /** 校验并写入等待处理的任务后立即返回，调度器随后从 MySQL 领取。 */
    @Transactional
    public Task create(String userId, String templateId, List<String> assetIds) {
        Template template = templateMapper.findById(templateId);
        if (template == null) {
            throw ApiException.notFound("TEMPLATE_NOT_FOUND", "模板不存在");
        }
        validateAssets(userId, template, assetIds);

        SimulationSettings.Snapshot simulation = simulationSettings.current();
        Instant now = Instant.now();
        Task task = new Task();
        task.setId(UUID.randomUUID().toString());
        task.setUserId(userId);
        task.setTemplateId(templateId);
        task.setStatus(TaskStatus.PENDING);
        task.setSimAssetCheckMs(simulation.assetCheckDelayMs());
        task.setSimGenerateMs(simulation.generateDelayMs());
        task.setSimResultMs(simulation.resultDelayMs());
        task.setSimFailStage(simulation.failStage());
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        taskMapper.insert(task);
        for (int i = 0; i < assetIds.size(); i++) {
            taskMapper.insertTaskAsset(task.getId(), i, assetIds.get(i));
        }
        return taskMapper.findById(task.getId());
    }

    public Task getOwned(String userId, String taskId) {
        Task task = taskMapper.findOwned(taskId, userId);
        if (task == null) {
            // 其他用户的任务同样返回 404，不暴露任务是否存在
            throw ApiException.notFound("TASK_NOT_FOUND", "任务不存在");
        }
        return task;
    }

    private void validateAssets(String userId, Template template, List<String> assetIds) {
        if (assetIds.size() != template.getRequiredImageCount()) {
            throw ApiException.badRequest("INVALID_ASSET_COUNT",
                    "该模板需要 " + template.getRequiredImageCount() + " 张图片");
        }
        if (new HashSet<>(assetIds).size() != assetIds.size()) {
            throw ApiException.badRequest("DUPLICATE_ASSET", "素材不能重复");
        }
        Map<String, Asset> assets = assetMapper.findOwned(userId, assetIds).stream()
                .collect(Collectors.toMap(Asset::getId, Function.identity()));
        for (String assetId : assetIds) {
            Asset asset = assets.get(assetId);
            if (asset == null) {
                throw ApiException.badRequest("ASSET_NOT_FOUND", "素材不存在或不属于当前用户");
            }
            if (asset.getSizeBytes() > template.getMaxFileSizeBytes()
                    || !template.acceptedMimeTypeList().contains(asset.getMimeType())) {
                throw ApiException.badRequest("ASSET_NOT_ACCEPTED", "素材不符合该模板的要求");
            }
        }
    }
}
