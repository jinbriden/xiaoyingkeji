"use client";

import { useRef } from "react";
import { formatDateTime } from "@/lib/format";
import { isTerminal, STAGES, stageLabel, type StageName, type Task } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  /** 查询暂时失败，卡片内容可能不是最新状态。 */
  stale: boolean;
  onRetry: () => void;
}

const STATUS_LABELS: Record<Task["status"], string> = {
  PENDING: "等待处理",
  PROCESSING: "处理中",
  SUCCEEDED: "成功",
  FAILED: "失败",
};

function stageState(task: Task, stage: StageName, index: number): "done" | "active" | "failed" | "todo" {
  if (task.status === "SUCCEEDED") {
    return "done";
  }
  const reached = STAGES.findIndex((item) => item.name === (task.failureStage ?? task.currentStage));
  if (reached < 0) {
    return "todo";
  }
  if (index < reached) {
    return "done";
  }
  if (index > reached) {
    return "todo";
  }
  return task.status === "FAILED" ? "failed" : "active";
}

function StageSteps({ task }: { task: Task }) {
  return (
    <ol className="stage-steps">
      {STAGES.map((stage, index) => (
        <li key={stage.name} className={`stage-step stage-${stageState(task, stage.name, index)}`}>
          {stage.label}
        </li>
      ))}
    </ol>
  );
}

export function TaskCard({ task, stale, onRetry }: TaskCardProps) {
  const previewRef = useRef<HTMLDialogElement>(null);
  const running = !isTerminal(task.status);
  const stage = stageLabel(task.currentStage);

  return (
    <article className="task-card" aria-label={`${task.templateTitle}：${STATUS_LABELS[task.status]}`}>
      <div className="task-visual">
        {task.status === "SUCCEEDED" && task.resultUrl ? (
          <button
            type="button"
            className="task-result-button"
            aria-label={`预览 ${task.templateTitle} 的结果图片`}
            onClick={() => previewRef.current?.showModal()}
          >
            <img src={task.resultUrl} alt={`${task.templateTitle} 的制作结果`} />
          </button>
        ) : (
          <div className="task-state" aria-live="polite">
            {running && <span className="spinner" aria-hidden="true" />}
            <p className="task-state-title">
              {task.status === "PROCESSING" && stage ? `${stage}中` : STATUS_LABELS[task.status]}
            </p>
            {task.status === "PENDING" && <p className="task-state-text">排队中，可以先去做别的</p>}
            {task.status === "FAILED" && (
              <p className="task-state-text">
                {stageLabel(task.failureStage) ?? "任务"}阶段失败：{task.failureReason ?? "未知原因"}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="task-body">
        <div className="task-heading">
          <h3>{task.templateTitle}</h3>
          <span className={`status-badge status-${task.status.toLowerCase()}`}>{STATUS_LABELS[task.status]}</span>
        </div>
        <time className="task-time" dateTime={task.createdAt}>
          {formatDateTime(task.createdAt)}
        </time>
        {task.status !== "PENDING" && <StageSteps task={task} />}
        {stale && running && (
          <div className="task-stale" role="status">
            <p>暂时无法获取最新状态，任务仍在后台执行</p>
            <button type="button" className="link-button" onClick={onRetry}>
              重新查询
            </button>
          </div>
        )}
      </div>

      {task.resultUrl && (
        <dialog ref={previewRef} className="dialog dialog-preview" aria-label={`${task.templateTitle} 结果预览`}>
          <div className="dialog-header">
            <h2>{task.templateTitle}</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="关闭预览"
              onClick={() => previewRef.current?.close()}
            >
              ×
            </button>
          </div>
          <img src={task.resultUrl} alt={`${task.templateTitle} 的制作结果大图`} />
        </dialog>
      )}
    </article>
  );
}
