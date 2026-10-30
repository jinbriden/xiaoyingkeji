-- 所有语句可重复执行，应用每次启动时都会运行
CREATE TABLE IF NOT EXISTS app_user (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at    DATETIME(3)  NOT NULL,
    CONSTRAINT uk_app_user_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS user_session (
    token_hash CHAR(64)    NOT NULL PRIMARY KEY,
    user_id    VARCHAR(36) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE TABLE IF NOT EXISTS template (
    id                   VARCHAR(64)  NOT NULL PRIMARY KEY,
    title                VARCHAR(100) NOT NULL,
    category             VARCHAR(50)  NOT NULL,
    cover_url            VARCHAR(255) NOT NULL,
    description          VARCHAR(500) NOT NULL,
    required_image_count INT          NOT NULL,
    accepted_mime_types  VARCHAR(255) NOT NULL,
    max_file_size_bytes  BIGINT       NOT NULL,
    sort_order           INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS asset (
    id           VARCHAR(36)  NOT NULL PRIMARY KEY,
    user_id      VARCHAR(36)  NOT NULL,
    storage_path VARCHAR(255) NOT NULL,
    mime_type    VARCHAR(50)  NOT NULL,
    size_bytes   BIGINT       NOT NULL,
    created_at   DATETIME(3)  NOT NULL,
    CONSTRAINT fk_asset_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE TABLE IF NOT EXISTS task (
    id                 VARCHAR(36)  NOT NULL PRIMARY KEY,
    user_id            VARCHAR(36)  NOT NULL,
    template_id        VARCHAR(64)  NOT NULL,
    status             VARCHAR(20)  NOT NULL,
    current_stage      VARCHAR(20)  NULL,
    failure_stage      VARCHAR(20)  NULL,
    failure_reason     VARCHAR(500) NULL,
    result_path        VARCHAR(255) NULL,
    -- 模拟配置在受理时固化，之后修改配置不影响已受理的任务
    sim_asset_check_ms BIGINT       NOT NULL,
    sim_generate_ms    BIGINT       NOT NULL,
    sim_result_ms      BIGINT       NOT NULL,
    sim_fail_stage     VARCHAR(20)  NULL,
    created_at         DATETIME(3)  NOT NULL,
    updated_at         DATETIME(3)  NOT NULL,
    started_at         DATETIME(3)  NULL,
    finished_at        DATETIME(3)  NULL,
    INDEX idx_task_user_created (user_id, created_at),
    INDEX idx_task_status_created (status, created_at),
    CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT fk_task_template FOREIGN KEY (template_id) REFERENCES template (id)
);

CREATE TABLE IF NOT EXISTS task_asset (
    task_id    VARCHAR(36) NOT NULL,
    sort_index INT         NOT NULL,
    asset_id   VARCHAR(36) NOT NULL,
    PRIMARY KEY (task_id, sort_index),
    CONSTRAINT fk_task_asset_task FOREIGN KEY (task_id) REFERENCES task (id),
    CONSTRAINT fk_task_asset_asset FOREIGN KEY (asset_id) REFERENCES asset (id)
);

-- 每个阶段一行，记录执行边界，便于观察和排查
CREATE TABLE IF NOT EXISTS task_stage_run (
    task_id     VARCHAR(36)  NOT NULL,
    stage       VARCHAR(20)  NOT NULL,
    status      VARCHAR(20)  NOT NULL,
    message     VARCHAR(500) NULL,
    started_at  DATETIME(3)  NOT NULL,
    finished_at DATETIME(3)  NULL,
    PRIMARY KEY (task_id, stage),
    CONSTRAINT fk_stage_run_task FOREIGN KEY (task_id) REFERENCES task (id)
);
