package com.xiaoying.studio.task;

import java.time.Instant;

public class TaskStageRun {

    private StageName stage;
    private String status;
    private String message;
    private Instant startedAt;
    private Instant finishedAt;

    public StageName getStage() {
        return stage;
    }

    public void setStage(StageName stage) {
        this.stage = stage;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
    }
}
