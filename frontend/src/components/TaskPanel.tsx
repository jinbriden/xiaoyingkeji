"use client";

import type { ReactNode } from "react";
import { useTasks, useTaskTracker } from "./TaskProvider";
import { TaskCard } from "./TaskCard";

interface TaskPanelProps {
  title: string;
  headingLevel?: "h1" | "h2";
  /** 只显示某个模板的任务；不传时显示全部。 */
  templateId?: string;
  emptyHint: ReactNode;
}

export function TaskPanel({ title, headingLevel: Heading = "h2", templateId, emptyHint }: TaskPanelProps) {
  const tracker = useTaskTracker();
  const { tasks, loading, queryError, paused } = useTasks();
  const visible = templateId ? tasks.filter((task) => task.templateId === templateId) : tasks;
  const retry = () => void tracker.refresh();

  return (
    <section className="task-panel" aria-labelledby="task-panel-title">
      <div className="panel-header">
        <Heading id="task-panel-title" className="panel-title">
          {title}
        </Heading>
        <button type="button" className="icon-button" aria-label="刷新任务记录" disabled={loading} onClick={retry}>
          ↻
        </button>
      </div>

      {queryError && (
        <div className="notice" role="status">
          <span>
            {queryError}
            {paused ? "。自动查询已暂停。" : "，正在自动重试。"}这不影响后台任务。
          </span>
          <button type="button" className="link-button" onClick={retry}>
            重新查询
          </button>
        </div>
      )}

      {visible.length > 0 ? (
        <div className="task-grid">
          {visible.map((task) => (
            <TaskCard key={task.id} task={task} stale={queryError !== null} onRetry={retry} />
          ))}
        </div>
      ) : loading ? (
        <p className="empty-state">正在加载任务记录…</p>
      ) : queryError ? null : (
        <div className="empty-state">{emptyHint}</div>
      )}
    </section>
  );
}
