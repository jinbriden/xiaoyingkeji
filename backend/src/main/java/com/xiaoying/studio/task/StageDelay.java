package com.xiaoying.studio.task;

import org.springframework.stereotype.Component;

/** 模拟阶段耗时。单独成类，测试时可以替换为不等待的实现。 */
@Component
public class StageDelay {

    public void sleep(long millis) throws InterruptedException {
        if (millis > 0) {
            Thread.sleep(millis);
        }
    }
}
