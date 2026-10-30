import { ApiError } from "./api";
import { isTerminal, type Task } from "./types";

export interface TaskApi {
  listTasks(signal?: AbortSignal): Promise<Task[]>;
  fetchTasks(ids: string[], signal?: AbortSignal): Promise<Task[]>;
}

export interface TrackerState {
  /** 按提交时间倒序排列。 */
  tasks: Task[];
  loading: boolean;
  /** 查询失败的提示。这是请求层面的问题，不代表任务失败，任务记录会被保留。 */
  queryError: string | null;
  /** 连续失败达到上限后暂停自动查询，等待用户手动恢复。 */
  paused: boolean;
}

export interface TrackerOptions {
  intervalMs?: number;
  maxFailures?: number;
  onUnauthorized?: () => void;
}

const IDLE_STATE: TrackerState = { tasks: [], loading: false, queryError: null, paused: false };

function isNewer(incoming: Task, existing: Task): boolean {
  if (isTerminal(existing.status)) {
    return false;
  }
  return isTerminal(incoming.status) || Date.parse(incoming.updatedAt) >= Date.parse(existing.updatedAt);
}

/**
 * 管理一个用户的全部任务。任务按 ID 独立存放，所有未结束任务共用一个轮询循环。
 * 每次切换用户都会递增 session，晚到的旧响应因 session 不匹配而被丢弃。
 */
export class TaskTracker {
  private state: TrackerState = IDLE_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly intervalMs: number;
  private readonly maxFailures: number;
  private readonly onUnauthorized?: () => void;

  private userId: string | null = null;
  private session = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;
  private polling = false;
  private failures = 0;
  private needsRecovery = false;

  constructor(
    private readonly taskApi: TaskApi,
    options: TrackerOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 2000;
    this.maxFailures = options.maxFailures ?? 5;
    this.onUnauthorized = options.onUnauthorized;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): TrackerState => this.state;

  getServerSnapshot = (): TrackerState => IDLE_STATE;

  /** 开始跟踪指定用户，从后端恢复记录。 */
  start(userId: string): void {
    if (this.userId === userId) {
      return;
    }
    this.stop();
    this.userId = userId;
    void this.reload();
  }

  /** 停止查询并清空数据，用于退出登录、切换用户和卸载。 */
  stop(): void {
    this.session += 1;
    this.userId = null;
    this.cancelPolling();
    this.failures = 0;
    this.needsRecovery = false;
    this.setState(IDLE_STATE);
  }

  /** 新任务受理后加入跟踪。 */
  add(task: Task): void {
    this.merge([task]);
    this.schedule();
  }

  /** 在提交时捕获会话；站内卸载不影响受理，退出/切换（含 A→B→A）使回调失效。 */
  captureSubmission(): (task: Task) => boolean {
    const session = this.session;
    const userId = this.userId;
    return (task) => {
      if (userId === null || session !== this.session) {
        return false;
      }
      this.add(task);
      return true;
    };
  }

  /** 手动刷新，也用于从查询异常中恢复。 */
  refresh(): Promise<void> {
    this.failures = 0;
    this.cancelPolling();
    this.setState({ ...this.state, paused: false });
    return this.reload();
  }

  private async reload(): Promise<void> {
    if (this.userId === null) return;
    const session = this.session;
    const controller = new AbortController();
    this.controller = controller;
    this.polling = true;
    this.needsRecovery = true;
    this.setState({ ...this.state, loading: true });
    try {
      const tasks = await this.taskApi.listTasks(controller.signal);
      if (!this.isCurrent(session, controller)) {
        return;
      }
      this.merge(tasks);
      this.needsRecovery = false;
      this.failures = 0;
      this.setState({ ...this.state, loading: false, queryError: null });
    } catch (error) {
      if (!this.isCurrent(session, controller)) {
        return;
      }
      this.setState({ ...this.state, loading: false });
      this.handleFailure(error);
    }
    if (!this.isCurrent(session, controller)) return;
    this.controller = null;
    this.polling = false;
    this.schedule();
  }

  /** session 区分用户身份，controller 区分同一身份下的多次刷新。 */
  private isCurrent(session: number, controller: AbortController): boolean {
    return session === this.session && this.controller === controller && !controller.signal.aborted;
  }

  private activeIds(): string[] {
    return this.state.tasks.filter((task) => !isTerminal(task.status)).map((task) => task.id);
  }

  private schedule(): void {
    if (this.timer !== null || this.polling || this.state.paused || this.userId === null) {
      return;
    }
    if (!this.needsRecovery && this.activeIds().length === 0) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void (this.needsRecovery ? this.reload() : this.poll());
    }, this.intervalMs);
  }

  private async poll(): Promise<void> {
    const session = this.session;
    const ids = this.activeIds();
    if (ids.length === 0) {
      return;
    }
    this.polling = true;
    const controller = new AbortController();
    this.controller = controller;
    let failed = false;
    const batches: string[][] = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
      batches.push(ids.slice(offset, offset + 100));
    }
    await Promise.all(batches.map(async (batch) => {
      try {
        const tasks = await this.taskApi.fetchTasks(batch, controller.signal);
        if (!this.isCurrent(session, controller)) return;
        const returned = new Set(tasks.map((task) => task.id));
        this.merge(tasks, batch.filter((id) => !returned.has(id)));
      } catch (error) {
        if (!this.isCurrent(session, controller)) return;
        // 一轮轮询只记一次失败，不按批次累计；成功的批次仍会合并
        if (!failed || (error instanceof ApiError && error.status === 401)) this.handleFailure(error);
        failed = true;
      }
    }));
    if (!this.isCurrent(session, controller)) return;
    if (!failed) {
      this.failures = 0;
      this.setState({ ...this.state, queryError: null });
    }
    this.controller = null;
    this.polling = false;
    this.schedule();
  }

  private handleFailure(error: unknown): void {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    if (error instanceof ApiError && error.status === 401) {
      this.onUnauthorized?.();
      return;
    }
    this.failures += 1;
    this.setState({
      ...this.state,
      queryError: error instanceof Error ? error.message : "查询失败",
      paused: this.failures >= this.maxFailures,
    });
  }

  /** 逐个任务合并，已结束的任务不会被旧数据覆盖。missing 是后端已不再返回的任务。 */
  private merge(incoming: Task[], missing: string[] = []): void {
    const tasks = new Map(this.state.tasks.map((task) => [task.id, task]));
    for (const id of missing) {
      tasks.delete(id);
    }
    for (const task of incoming) {
      const existing = tasks.get(task.id);
      if (!existing || isNewer(task, existing)) {
        tasks.set(task.id, task);
      }
    }
    const sorted = [...tasks.values()].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id),
    );
    this.setState({ ...this.state, tasks: sorted });
  }

  private cancelPolling(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.controller?.abort();
    this.controller = null;
    this.polling = false;
  }

  private setState(next: TrackerState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
}
