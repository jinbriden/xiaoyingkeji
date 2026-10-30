package com.xiaoying.studio.task;

import java.time.Instant;

public class Task {

    private String id;
    private String userId;
    private String templateId;
    private String templateTitle;
    private String templateCoverUrl;
    private TaskStatus status;
    private StageName currentStage;
    private StageName failureStage;
    private String failureReason;
    private String resultPath;
    private long simAssetCheckMs;
    private long simGenerateMs;
    private long simResultMs;
    private StageName simFailStage;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant startedAt;
    private Instant finishedAt;

    public long delayMsOf(StageName stage) {
        return switch (stage) {
            case ASSET_CHECK -> simAssetCheckMs;
            case GENERATE -> simGenerateMs;
            case RESULT -> simResultMs;
        };
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getTemplateId() {
        return templateId;
    }

    public void setTemplateId(String templateId) {
        this.templateId = templateId;
    }

    public String getTemplateTitle() {
        return templateTitle;
    }

    public void setTemplateTitle(String templateTitle) {
        this.templateTitle = templateTitle;
    }

    public String getTemplateCoverUrl() {
        return templateCoverUrl;
    }

    public void setTemplateCoverUrl(String templateCoverUrl) {
        this.templateCoverUrl = templateCoverUrl;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public void setStatus(TaskStatus status) {
        this.status = status;
    }

    public StageName getCurrentStage() {
        return currentStage;
    }

    public void setCurrentStage(StageName currentStage) {
        this.currentStage = currentStage;
    }

    public StageName getFailureStage() {
        return failureStage;
    }

    public void setFailureStage(StageName failureStage) {
        this.failureStage = failureStage;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }

    public String getResultPath() {
        return resultPath;
    }

    public void setResultPath(String resultPath) {
        this.resultPath = resultPath;
    }

    public long getSimAssetCheckMs() {
        return simAssetCheckMs;
    }

    public void setSimAssetCheckMs(long simAssetCheckMs) {
        this.simAssetCheckMs = simAssetCheckMs;
    }

    public long getSimGenerateMs() {
        return simGenerateMs;
    }

    public void setSimGenerateMs(long simGenerateMs) {
        this.simGenerateMs = simGenerateMs;
    }

    public long getSimResultMs() {
        return simResultMs;
    }

    public void setSimResultMs(long simResultMs) {
        this.simResultMs = simResultMs;
    }

    public StageName getSimFailStage() {
        return simFailStage;
    }

    public void setSimFailStage(StageName simFailStage) {
        this.simFailStage = simFailStage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
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
