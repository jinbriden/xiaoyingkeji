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
    it("splits all active IDs into batches of at most 100", async () => {
      const tasks = Array.from({ length: 205 }, (_, index) => task(`task-${index}`));
      listTasks.mockResolvedValue(tasks);
      fetchTasks.mockImplementation(async (ids) => ids.map((id) => task(id, { status: "SUCCEEDED" })));
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(1000);

      expect(fetchTasks.mock.calls.map(([ids]) => ids.length)).toEqual([100, 100, 5]);
      const requested = fetchTasks.mock.calls.flatMap(([ids]) => ids);
      expect([...requested].sort()).toEqual(tasks.map(({ id }) => id).sort());
      expect(new Set(requested).size).toBe(tasks.length);
      expect(tracker.getSnapshot().tasks.every(({ status }) => status === "SUCCEEDED")).toBe(true);
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchTasks).toHaveBeenCalledTimes(3);
    });

    it("merges each successful batch independently while another fails or remains pending", async () => {
      listTasks.mockResolvedValue(Array.from({ length: 205 }, (_, index) => task(`task-${index}`)));
      const pending = deferred<Task[]>();
      fetchTasks.mockRejectedValueOnce(new ApiError(503, "UNAVAILABLE", "batch unavailable"))
        .mockImplementationOnce(async (ids) => ids.slice(1).map((id) => task(id, { status: "SUCCEEDED" })))
        .mockReturnValueOnce(pending.promise);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(1000);

      expect(fetchTasks).toHaveBeenCalledTimes(3);
      const [failed, successful, waiting] = fetchTasks.mock.calls.map(([ids]) => ids);
      expect(failed.every((id) => find(id)?.status === "PENDING")).toBe(true);
      expect(find(successful[0])).toBeUndefined();
      expect(successful.slice(1).every((id) => find(id)?.status === "SUCCEEDED")).toBe(true);
      expect(tracker.getSnapshot().queryError).toBe("batch unavailable");
      expect(waiting.every((id) => find(id)?.status === "PENDING")).toBe(true);
      pending.resolve(waiting.map((id) => task(id, { status: "SUCCEEDED" })));
      await vi.advanceTimersByTimeAsync(0);
      expect(waiting.every((id) => find(id)?.status === "SUCCEEDED")).toBe(true);
      expect(tracker.getSnapshot()).toMatchObject({ queryError: "batch unavailable", paused: false });
    });

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

  describe("时间比较", () => {
    // 后端时间在毫秒为 0 时不带小数，例如 10:00:01Z，不能按字符串比较
    it("同一秒内较晚的状态不会被当作旧数据丢弃", async () => {
      listTasks.mockResolvedValue([task("a", { status: "PROCESSING", updatedAt: "2026-10-30T10:00:01Z" })]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      fetchTasks.mockResolvedValue([
        task("a", { status: "PROCESSING", currentStage: "GENERATE", updatedAt: "2026-10-30T10:00:01.500Z" }),
      ]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(find("a")?.currentStage).toBe("GENERATE");
    });

    it("同一秒内提交的任务按实际时间倒序排列", async () => {
      listTasks.mockResolvedValue([
        task("early", { status: "SUCCEEDED", createdAt: "2026-10-30T10:00:01Z" }),
        task("late", { status: "SUCCEEDED", createdAt: "2026-10-30T10:00:01.500Z" }),
      ]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);

      expect(tracker.getSnapshot().tasks.map((item) => item.id)).toEqual(["late", "early"]);
    });
  });

  describe("查询异常与任务失败的区分", () => {
    it("retries failed initial list recovery without any known active IDs", async () => {
      listTasks.mockRejectedValueOnce(new ApiError(503, "UNAVAILABLE", "list unavailable"))
        .mockResolvedValueOnce([task("recovered")]);
      fetchTasks.mockResolvedValue([task("recovered", { status: "SUCCEEDED" })]);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);
      expect(tracker.getSnapshot()).toMatchObject({ tasks: [], queryError: "list unavailable", paused: false, loading: false });
      await vi.advanceTimersByTimeAsync(1000);
      expect(listTasks).toHaveBeenCalledTimes(2);
      expect(tracker.getSnapshot().queryError).toBeNull();
      expect(find("recovered")?.status).toBe("PENDING");
      await vi.advanceTimersByTimeAsync(1000);
      expect(find("recovered")?.status).toBe("SUCCEEDED");
      await vi.advanceTimersByTimeAsync(5000);
      expect(listTasks).toHaveBeenCalledTimes(2);
      expect(fetchTasks).toHaveBeenCalledOnce();
    });

    it("pauses list recovery after five failures and manual refresh resumes it", async () => {
      tracker = new TaskTracker({ listTasks, fetchTasks }, { intervalMs: 1000 });
      listTasks.mockRejectedValue(new ApiError(503, "UNAVAILABLE", "list unavailable"));
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(20000);
      expect(listTasks).toHaveBeenCalledTimes(5);
      expect(tracker.getSnapshot()).toMatchObject({ tasks: [], paused: true, loading: false });
      expect(fetchTasks).not.toHaveBeenCalled();
      listTasks.mockResolvedValue([]);
      await tracker.refresh();
      expect(tracker.getSnapshot()).toMatchObject({ tasks: [], paused: false, loading: false, queryError: null });
      await vi.advanceTimersByTimeAsync(10000);
      expect(listTasks).toHaveBeenCalledTimes(6);
      expect(fetchTasks).not.toHaveBeenCalled();
    });

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
    it("does not start polling while list recovery is still in flight", async () => {
      const pending = deferred<Task[]>();
      listTasks.mockReturnValue(pending.promise);
      tracker.start("user-1");
      tracker.add(task("a"));
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchTasks).not.toHaveBeenCalled();
      pending.resolve([task("a")]);
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchTasks).toHaveBeenCalledOnce();
    });

    it.each(["success", "401", "network"])("ignores superseded same-session list %s including loading and errors", async (outcome) => {
      const onUnauthorized = vi.fn();
      tracker = new TaskTracker({ listTasks, fetchTasks }, { intervalMs: 1000, onUnauthorized });
      const old = deferred<Task[]>();
      const latest = deferred<Task[]>();
      listTasks.mockResolvedValueOnce([task("a")]).mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(0);
      const oldRefresh = tracker.refresh();
      const oldSignal = listTasks.mock.calls[1][0];
      const latestRefresh = tracker.refresh();
      expect(oldSignal?.aborted).toBe(true);
      if (outcome === "success") old.resolve([task("a", { status: "SUCCEEDED" })]);
      else old.reject(new ApiError(outcome === "401" ? 401 : 503, "OLD", "obsolete error"));
      await oldRefresh;
      expect(tracker.getSnapshot()).toMatchObject({ loading: true, queryError: null });
      expect(find("a")?.status).toBe("PENDING");
      expect(onUnauthorized).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchTasks).not.toHaveBeenCalled();
      latest.resolve([task("a", { status: "SUCCEEDED" })]);
      await latestRefresh;
      expect(tracker.getSnapshot().loading).toBe(false);
    });

    it.each(["success", "401", "network"])("superseded poll %s cannot mutate or finish a newer poll", async (outcome) => {
      const onUnauthorized = vi.fn();
      tracker = new TaskTracker({ listTasks, fetchTasks }, { intervalMs: 1000, onUnauthorized });
      listTasks.mockResolvedValueOnce([task("a")]);
      const old = deferred<Task[]>();
      const latest = deferred<Task[]>();
      fetchTasks.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
      tracker.start("user-1");
      await vi.advanceTimersByTimeAsync(1000);
      const oldSignal = fetchTasks.mock.calls[0][1];
      listTasks.mockResolvedValue([task("a", { status: "PROCESSING", currentStage: "GENERATE", updatedAt: later(1) })]);
      await tracker.refresh();
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchTasks).toHaveBeenCalledTimes(2);
      expect(oldSignal?.aborted).toBe(true);
      if (outcome === "success") old.resolve([task("a", { status: "PROCESSING", currentStage: "ASSET_CHECK", updatedAt: later(10) })]);
      else old.reject(new ApiError(outcome === "401" ? 401 : 503, "OLD", "obsolete error"));
      await vi.advanceTimersByTimeAsync(5000);
      expect(onUnauthorized).not.toHaveBeenCalled();
      expect(tracker.getSnapshot().queryError).toBeNull();
      expect(find("a")?.currentStage).toBe("GENERATE");
      expect(fetchTasks).toHaveBeenCalledTimes(2);
      expect(fetchTasks.mock.calls[1][1]?.aborted).toBe(false);
      latest.resolve([task("a", { status: "SUCCEEDED", updatedAt: later(11) })]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(find("a")?.status).toBe("SUCCEEDED");
      expect(fetchTasks).toHaveBeenCalledTimes(2);
    });

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
