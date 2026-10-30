import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import type { Task } from "@/lib/types";
import { TaskCard } from "./TaskCard";

const base: Task = {
  id: "task-1",
  templateId: "demo",
  templateTitle: "旅行明信片",
  templateCoverUrl: "/cover.jpg",
  status: "PROCESSING",
  currentStage: "GENERATE",
  failureStage: null,
  failureReason: null,
  resultUrl: null,
  createdAt: "2026-10-30T10:00:00.000Z",
  updatedAt: "2026-10-30T10:00:00.000Z",
  finishedAt: null,
};

afterEach(cleanup);

describe("TaskCard", () => {
  it("查询异常时仍显示处理中，并提供重新查询，而不是显示失败", () => {
    render(<TaskCard task={base} stale onRetry={vi.fn()} />);

    expect(screen.getByText("模拟生成中")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新查询" })).toBeInTheDocument();
    expect(screen.queryByText("失败")).not.toBeInTheDocument();
  });

  it("任务失败时显示失败阶段和原因，不提示查询问题", () => {
    render(
      <TaskCard
        task={{ ...base, status: "FAILED", currentStage: null, failureStage: "GENERATE", failureReason: "素材不足" }}
        stale
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("模拟生成阶段失败：素材不足")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新查询" })).not.toBeInTheDocument();
  });

  it("等待中和成功状态可以区分", () => {
    const { rerender } = render(
      <TaskCard task={{ ...base, status: "PENDING", currentStage: null }} stale={false} onRetry={vi.fn()} />,
    );
    expect(screen.getByText("排队中，可以先去做别的")).toBeInTheDocument();

    rerender(
      <TaskCard
        task={{ ...base, status: "SUCCEEDED", currentStage: null, resultUrl: "/api/tasks/task-1/result" }}
        stale={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole("img", { name: "旅行明信片 的制作结果" })).toBeInTheDocument();
  });
});
