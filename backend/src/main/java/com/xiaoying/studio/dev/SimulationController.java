package com.xiaoying.studio.dev;

import com.xiaoying.studio.task.SimulationSettings;
import com.xiaoying.studio.task.StageName;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 演示用开发接口：调整模拟耗时、指定失败阶段。默认关闭，由 DEV_API_ENABLED 开启。 */
@RestController
@RequestMapping("/api/dev/simulation")
@ConditionalOnProperty(name = "app.dev-api.enabled", havingValue = "true")
public class SimulationController {

    public record SimulationRequest(@Min(0) @Max(120000) long assetCheckDelayMs,
                                    @Min(0) @Max(120000) long generateDelayMs,
                                    @Min(0) @Max(120000) long resultDelayMs,
                                    StageName failStage) {
    }

    private final SimulationSettings settings;

    public SimulationController(SimulationSettings settings) {
        this.settings = settings;
    }

    @GetMapping
    public SimulationSettings.Snapshot get() {
        return settings.current();
    }

    @PutMapping
    public SimulationSettings.Snapshot update(@Valid @RequestBody SimulationRequest body) {
        settings.update(new SimulationSettings.Snapshot(body.assetCheckDelayMs(), body.generateDelayMs(),
                body.resultDelayMs(), body.failStage()));
        return settings.current();
    }
}
