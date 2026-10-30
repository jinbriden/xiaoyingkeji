"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/lib/api";
import { TaskTracker, type TrackerState } from "@/lib/taskTracker";
import { useAuth } from "./AuthProvider";

const TrackerContext = createContext<TaskTracker | null>(null);

/**
 * 放在根布局，页面切换时继续跟踪任务。
 * 用户变化或退出登录时停止并清空，没有未结束任务时跟踪器自身不发请求。
 */
export function TaskProvider({ children }: { children: ReactNode }) {
  const { user, expire } = useAuth();
  const expireRef = useRef(expire);
  useEffect(() => {
    expireRef.current = expire;
  }, [expire]);

  const tracker = useMemo(() => new TaskTracker(api, { onUnauthorized: () => expireRef.current() }), []);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId) {
      tracker.start(userId);
    } else {
      tracker.stop();
    }
    return () => tracker.stop();
  }, [tracker, userId]);

  return <TrackerContext.Provider value={tracker}>{children}</TrackerContext.Provider>;
}

export function useTaskTracker(): TaskTracker {
  const tracker = useContext(TrackerContext);
  if (!tracker) {
    throw new Error("useTaskTracker must be used inside TaskProvider");
  }
  return tracker;
}

export function useTasks(): TrackerState {
  const tracker = useTaskTracker();
  return useSyncExternalStore(tracker.subscribe, tracker.getSnapshot, tracker.getServerSnapshot);
}
