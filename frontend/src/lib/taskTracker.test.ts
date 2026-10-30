import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { TaskTracker, type TaskApi } from "./taskTracker";
import type { Task } from "./types";

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    templateId: "demo",
    templateTitle: "模板",
    templateCoverUrl: "/cover.jpg",
    status: "PENDING",
    currentStage: null,
    failureStage: null,
    failureReason: null,
    resultUrl: null,
    createdAt: `2026-10-30T10:00:0${id.length}.000Z`,
    updatedAt: "2026-10-30T10:00:00.000Z",
    finishedAt: null,
    ...overrides,
  };
}

const later = (seconds: number) => `2026-10-30T10:01:${String(seconds).padStart(2, "0")}.000Z`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("TaskTracker", () => {
  const listTasks = vi.fn<TaskApi["listTasks"]>();
  const fetchTasks = vi.fn<TaskApi["fetchTasks"]>();
  let tracker: TaskTracker;

  const find = (id: string) => tracker.getSnapshot().tasks.find((item) => item.id === id);

  beforeEach(() => {
    vi.useFakeTimers();
    listTasks.mockReset().mockResolvedValue([]);
    fetchTasks.mockReset().mockResolvedValue([]);
    tracker = new TaskTracker({ listTasks, fetchTasks }, { intervalMs: 1000, maxFailures: 3 });
  });

  afterEach(() => {
    tracker.stop();
    vi.useRealTimers();
  });

  describe("多任务互不串扰", () => {
    it("每个任务独立保存状态、阶段、错误和结果", async () => {
      listTasks.mockResolvedValue([task("a"), task("bb"), task("ccc")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      fetchTasks.mockResolvedValue([
        task("a", { status: "PROCESSING", currentStage: "GENERATE", updatedAt: later(1) }),
        task("bb", {
          status: "FAILED",
          failureStage: "ASSET_CHECK",
          failureReason: "素材检查未通过",
          updatedAt: later(1),
        }),
        task("ccc", { status: "SUCCEEDED", resultUrl: "/api/tasks/ccc/result", updatedAt: later(1) }),
      ]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(find("a")).toMatchObject({ status: "PROCESSING", currentStage: "GENERATE", failureReason: null });
      expect(find("bb")).toMatchObject({ status: "FAILED", failureReason: "素材检查未通过", resultUrl: null });
      expect(find("ccc")).toMatchObject({ status: "SUCCEEDED", resultUrl: "/api/tasks/ccc/result" });
    });

    it("只查询未结束的任务，已结束的任务退出跟踪", async () => {
      listTasks.mockResolvedValue([task("a"), task("bb")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      fetchTasks.mockResolvedValueOnce([
        task("a", { status: "SUCCEEDED", updatedAt: later(1) }),
        task("bb", { status: "PROCESSING", updatedAt: later(1) }),
      ]);
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchTasks.mock.calls[0][0]).toEqual(["bb", "a"]);

      fetchTasks.mockResolvedValueOnce([task("bb", { status: "PROCESSING", updatedAt: later(2) })]);
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchTasks.mock.calls[1][0]).toEqual(["bb"]);
    });

    it("已结束的任务不会被延迟到达的旧状态覆盖", async () => {
      listTasks.mockResolvedValue([task("a", { status: "SUCCEEDED", updatedAt: later(5) })]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      tracker.add(task("a", { status: "PROCESSING", updatedAt: later(1) }));

      expect(find("a")?.status).toBe("SUCCEEDED");
    });
  });

  describe("查询异常与任务失败的区分", () => {
    it("查询失败时保留任务原状态，并单独记录查询错误", async () => {
      listTasks.mockResolvedValue([task("a", { status: "PROCESSING", currentStage: "GENERATE" })]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      fetchTasks.mockRejectedValue(new ApiError(503, "UNAVAILABLE", "无法连接服务"));
      await vi.advanceTimersByTimeAsync(1000);

      expect(find("a")).toMatchObject({ status: "PROCESSING", currentStage: "GENERATE", failureReason: null });
      expect(tracker.getSnapshot().queryError).toBe("无法连接服务");
    });

    it("后端返回的任务失败不算查询错误", async () => {
      listTasks.mockResolvedValue([task("a")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      fetchTasks.mockResolvedValue([
        task("a", { status: "FAILED", failureStage: "GENERATE", failureReason: "生成失败", updatedAt: later(1) }),
      ]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(find("a")?.status).toBe("FAILED");
      expect(tracker.getSnapshot().queryError).toBeNull();
    });

    it("查询恢复后清除错误并继续更新", async () => {
      listTasks.mockResolvedValue([task("a")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      fetchTasks.mockRejectedValueOnce(new ApiError(0, "UNREACHABLE", "断网"));
      await vi.advanceTimersByTimeAsync(1000);
      expect(tracker.getSnapshot().queryError).toBe("断网");

      fetchTasks.mockResolvedValueOnce([task("a", { status: "SUCCEEDED", updatedAt: later(1) })]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(tracker.getSnapshot().queryError).toBeNull();
      expect(find("a")?.status).toBe("SUCCEEDED");
    });

    it("连续失败后暂停自动查询，手动刷新可以恢复", async () => {
      listTasks.mockResolvedValue([task("a")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      fetchTasks.mockRejectedValue(new ApiError(0, "UNREACHABLE", "断网"));
      await vi.advanceTimersByTimeAsync(10000);
      expect(fetchTasks).toHaveBeenCalledTimes(3);
      expect(tracker.getSnapshot().paused).toBe(true);
      expect(find("a")?.status).toBe("PENDING");

      listTasks.mockResolvedValue([task("a", { status: "PROCESSING", updatedAt: later(1) })]);
      fetchTasks.mockResolvedValue([task("a", { status: "SUCCEEDED", updatedAt: later(2) })]);
      await tracker.refresh();
      await vi.advanceTimersByTimeAsync(1000);

      expect(tracker.getSnapshot()).toMatchObject({ paused: false, queryError: null });
      expect(find("a")?.status).toBe("SUCCEEDED");
    });
  });

  describe("查询生命周期", () => {
    it("没有未结束任务时不发起轮询", async () => {
      listTasks.mockResolvedValue([task("a", { status: "SUCCEEDED" })]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(5000);

      expect(fetchTasks).not.toHaveBeenCalled();
    });

    it("全部任务结束后停止轮询，新任务加入后重新开始", async () => {
      listTasks.mockResolvedValue([task("a")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      fetchTasks.mockResolvedValueOnce([task("a", { status: "SUCCEEDED", updatedAt: later(1) })]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchTasks).toHaveBeenCalledTimes(1);

      fetchTasks.mockResolvedValue([task("bb", { status: "PROCESSING", updatedAt: later(2) })]);
      tracker.add(task("bb"));
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchTasks).toHaveBeenCalledTimes(2);
      expect(fetchTasks.mock.calls[1][0]).toEqual(["bb"]);
    });

    it("上一次查询未返回时不会叠加新查询", async () => {
      listTasks.mockResolvedValue([task("a")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      const pending = deferred<Task[]>();
      fetchTasks.mockReturnValue(pending.promise);
      await vi.advanceTimersByTimeAsync(5000);

      expect(fetchTasks).toHaveBeenCalledTimes(1);
    });

    it("刷新后从后端恢复记录并继续跟踪未完成任务", async () => {
      listTasks.mockResolvedValue([task("a", { status: "PROCESSING", currentStage: "RESULT" })]);
      fetchTasks.mockResolvedValue([task("a", { status: "SUCCEEDED", updatedAt: later(1) })]);

      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);
      expect(find("a")?.currentStage).toBe("RESULT");

      await vi.advanceTimersByTimeAsync(1000);
      expect(find("a")?.status).toBe("SUCCEEDED");
    });

    it("切换用户时取消进行中的请求，旧响应不会写入新用户", async () => {
      listTasks.mockResolvedValueOnce([task("a")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      const staleQuery = deferred<Task[]>();
      fetchTasks.mockReturnValueOnce(staleQuery.promise);
      await vi.advanceTimersByTimeAsync(1000);
      const signal = fetchTasks.mock.calls[0][1];

      listTasks.mockResolvedValueOnce([task("bb", { status: "SUCCEEDED" })]);
      tracker.start("user-2");
      await vi.advanceTimersByTimeAsync(0);

      expect(signal?.aborted).toBe(true);
      staleQuery.resolve([task("a", { status: "SUCCEEDED", updatedAt: later(1) })]);
      await vi.advanceTimersByTimeAsync(5000);

      expect(tracker.getSnapshot().tasks.map((item) => item.id)).toEqual(["bb"]);
      expect(fetchTasks).toHaveBeenCalledTimes(1);
    });

    it("旧用户的列表响应晚于切换到达时被丢弃", async () => {
      const staleList = deferred<Task[]>();
      listTasks.mockReturnValueOnce(staleList.promise);
      tracker.start("user-1");

      listTasks.mockResolvedValueOnce([task("bb", { status: "SUCCEEDED" })]);
      tracker.start("user-2");
      await vi.advanceTimersByTimeAsync(0);

      staleList.resolve([task("a")]);
      await vi.advanceTimersByTimeAsync(0);

      expect(tracker.getSnapshot().tasks.map((item) => item.id)).toEqual(["bb"]);
    });

    it("停止后清空数据且不再查询", async () => {
      listTasks.mockResolvedValue([task("a")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      tracker.stop();
      await vi.advanceTimersByTimeAsync(5000);

      expect(tracker.getSnapshot().tasks).toEqual([]);
      expect(fetchTasks).not.toHaveBeenCalled();
    });

    it("登录失效时通知上层，不记为查询错误", async () => {
      const onUnauthorized = vi.fn();
      tracker = new TaskTracker({ listTasks, fetchTasks }, { intervalMs: 1000, onUnauthorized });
      listTasks.mockResolvedValue([task("a")]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      fetchTasks.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "请先登录"));
      await vi.advanceTimersByTimeAsync(1000);

      expect(onUnauthorized).toHaveBeenCalledOnce();
      expect(tracker.getSnapshot().queryError).toBeNull();
    });
  });
});
