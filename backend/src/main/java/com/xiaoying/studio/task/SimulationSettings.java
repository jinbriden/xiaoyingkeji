package com.xiaoying.studio.task;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 模拟生成器的运行时配置。初始值来自环境变量，开发接口可以在运行时修改。
 * 任务受理时会把当前值写入任务记录，所以修改只影响之后提交的任务。
 */
@Component
public class SimulationSettings {

    public record Snapshot(long assetCheckDelayMs, long generateDelayMs, long resultDelayMs, StageName failStage) {
    }

    private volatile Snapshot current;

    public SimulationSettings(@Value("${app.simulation.asset-check-delay-ms}") long assetCheckDelayMs,
                              @Value("${app.simulation.generate-delay-ms}") long generateDelayMs,
                              @Value("${app.simulation.result-delay-ms}") long resultDelayMs,
                              @Value("${app.simulation.fail-stage:}") String failStage) {
        this.current = new Snapshot(assetCheckDelayMs, generateDelayMs, resultDelayMs,
                failStage == null || failStage.isBlank() ? null : StageName.valueOf(failStage.trim()));
    }

    public Snapshot current() {
        return current;
    }

    public void update(Snapshot snapshot) {
        this.current = snapshot;
    }
}
