package com.xiaoying.studio.task;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import com.xiaoying.studio.task.stage.StageContext;
import com.xiaoying.studio.task.stage.TaskStage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** 在后台线程中按顺序执行任务的三个阶段，每个阶段的开始和结束都写入 MySQL。 */
@Component
public class TaskRunner {

    private static final Logger log = LoggerFactory.getLogger(TaskRunner.class);

    private final TaskMapper taskMapper;
    private final StageDelay stageDelay;
    private final List<TaskStage> stages;

    public TaskRunner(TaskMapper taskMapper, StageDelay stageDelay, List<TaskStage> stages) {
        this.taskMapper = taskMapper;
        this.stageDelay = stageDelay;
        this.stages = new ArrayList<>(stages);
        this.stages.sort(Comparator.comparing(TaskStage::name));
    }

    /** 调用前任务必须已被领取为处理中。 */
    public void run(String taskId) {
        Task task = taskMapper.findById(taskId);
        StageContext context = new StageContext(task);
        for (TaskStage stage : stages) {
            if (!runStage(task, stage, context)) {
                return;
            }
        }
        taskMapper.markSucceeded(taskId, context.getResultPath(), Instant.now());
        log.info("Task {} succeeded", taskId);
    }

    /** 返回 false 表示任务已终止，不再执行后续阶段。 */
    private boolean runStage(Task task, TaskStage stage, StageContext context) {
        String taskId = task.getId();
        StageName name = stage.name();
        taskMapper.updateStage(taskId, name, Instant.now());
        taskMapper.insertStageRun(taskId, name, Instant.now());
        log.info("Task {} entered stage {}", taskId, name);
        try {
            stageDelay.sleep(task.delayMsOf(name));
            if (name == task.getSimFailStage()) {
                throw new StageFailedException(name.label() + "未通过（模拟失败）");
            }
            stage.execute(context);
            taskMapper.finishStageRun(taskId, name, "SUCCEEDED", null, Instant.now());
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            fail(taskId, name, "服务关闭，任务已中断");
            return false;
        } catch (StageFailedException e) {
            fail(taskId, name, e.getMessage());
            return false;
        } catch (RuntimeException e) {
            log.error("Task {} crashed in stage {}", taskId, name, e);
            fail(taskId, name, name.label() + "时发生内部错误");
            return false;
        }
    }

    private void fail(String taskId, StageName stage, String reason) {
        Instant now = Instant.now();
        taskMapper.finishStageRun(taskId, stage, "FAILED", reason, now);
        taskMapper.markFailed(taskId, stage, reason, now);
        log.info("Task {} failed in stage {}: {}", taskId, stage, reason);
    }
}
