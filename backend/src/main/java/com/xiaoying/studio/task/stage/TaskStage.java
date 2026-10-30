package com.xiaoying.studio.task.stage;

import com.xiaoying.studio.task.StageName;

/** 一个制作阶段。失败时抛出 {@link com.xiaoying.studio.task.StageFailedException}。 */
public interface TaskStage {

    StageName name();

    void execute(StageContext context);
}
