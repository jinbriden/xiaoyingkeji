package com.xiaoying.studio.task;

import java.time.Instant;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** SQL 见 resources/mapper/TaskMapper.xml。状态变更都带前置状态条件，终态不会被覆盖。 */
@Mapper
public interface TaskMapper {

    void insert(Task task);

    void insertTaskAsset(@Param("taskId") String taskId, @Param("sortIndex") int sortIndex,
                         @Param("assetId") String assetId);

    Task findById(String id);

    Task findOwned(@Param("id") String id, @Param("userId") String userId);

    List<Task> findOwnedByIds(@Param("userId") String userId, @Param("ids") List<String> ids);

    List<Task> findByUser(@Param("userId") String userId, @Param("templateId") String templateId,
                          @Param("limit") int limit);

    List<String> findPendingIds(int limit);

    /** 把任务从等待处理改为处理中，返回 1 表示抢占成功。 */
    int claim(@Param("id") String id, @Param("now") Instant now);

    int updateStage(@Param("id") String id, @Param("stage") StageName stage, @Param("now") Instant now);

    int markSucceeded(@Param("id") String id, @Param("resultPath") String resultPath, @Param("now") Instant now);

    int markFailed(@Param("id") String id, @Param("stage") StageName stage, @Param("reason") String reason,
                   @Param("now") Instant now);

    /** 服务启动时调用：上次运行遗留的处理中任务已无线程执行，统一置为失败。 */
    int failInterrupted(@Param("reason") String reason, @Param("now") Instant now);

    void insertStageRun(@Param("taskId") String taskId, @Param("stage") StageName stage, @Param("now") Instant now);

    void finishStageRun(@Param("taskId") String taskId, @Param("stage") StageName stage,
                        @Param("status") String status, @Param("message") String message, @Param("now") Instant now);

    List<TaskStageRun> findStageRuns(String taskId);
}
