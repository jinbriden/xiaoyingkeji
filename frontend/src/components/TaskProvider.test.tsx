import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Task, User } from "@/lib/types";

const controls = vi.hoisted(() => ({ me: vi.fn(), login: vi.fn(), logout: vi.fn(), listTasks: vi.fn(), fetchTasks: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()), api: controls,
}));
import { AuthProvider, useAuth } from "./AuthProvider";
import { TaskProvider, useTaskTracker } from "./TaskProvider";
import { ApiError } from "@/lib/api";

const A: User = { id: "A", email: "a@example.test" };
const accepted: Task = {
  id: "old-accepted", templateId: "demo", templateTitle: "private", templateCoverUrl: "",
  status: "PENDING", currentStage: null, failureStage: null, failureReason: null, resultUrl: null,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", finishedAt: null,
};
let auth: ReturnType<typeof useAuth>;
let tracker: ReturnType<typeof useTaskTracker>;
function Harness() {
  auth = useAuth();
  tracker = useTaskTracker();
  return <span>{auth.status}:{auth.user?.id}</span>;
}
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("batched logout and same-user re-login invalidates the old tracker session under StrictMode", async () => {
  controls.me.mockResolvedValue(A);
  controls.listTasks.mockResolvedValue([]);
  controls.logout.mockResolvedValue(undefined);
  controls.login.mockResolvedValue({ ...A });
  render(<StrictMode><AuthProvider><TaskProvider><Harness /></TaskProvider></AuthProvider></StrictMode>);
  await act(async () => {});
  const accept = tracker.captureSubmission();
  // React need not commit the intermediate anonymous identity.
  await act(async () => {
    await auth.logout();
    await auth.login(A.email, "fixture");
  });
  expect(auth.status).toBe("authenticated");
  expect(auth.user?.id).toBe("A");
  expect(accept(accepted)).toBe(false);
  expect(tracker.getSnapshot().tasks).toEqual([]);
});

it("a delayed list 401 cannot expire an already accepted login before tracker effects commit", async () => {
  controls.me.mockResolvedValue(A);
  let reject!: (error: unknown) => void;
  controls.listTasks.mockReturnValueOnce(new Promise<Task[]>((_, rej) => { reject = rej; })).mockResolvedValue([]);
  controls.login.mockResolvedValue({ id: "B", email: "b@example.test" });
  render(<AuthProvider><TaskProvider><Harness /></TaskProvider></AuthProvider>);
  await act(async () => {});
  await act(async () => {
    await auth.login("b@example.test", "fixture");
    // Auth has accepted B, but React has not yet run TaskProvider's effect cleanup for A.
    reject(new ApiError(401, "OLD", "A session expired"));
    await Promise.resolve();
  });
  expect(auth.status).toBe("authenticated");
  expect(auth.user?.id).toBe("B");
});

it("a delayed list 401 cannot cancel a newer login that is still pending", async () => {
  controls.me.mockResolvedValue(A);
  let rejectList!: (error: unknown) => void;
  controls.listTasks.mockReturnValueOnce(new Promise<Task[]>((_, reject) => { rejectList = reject; })).mockResolvedValue([]);
  let resolveLogin!: (user: User) => void;
  controls.login.mockReturnValue(new Promise<User>((resolve) => { resolveLogin = resolve; }));
  render(<AuthProvider><TaskProvider><Harness /></TaskProvider></AuthProvider>);
  await act(async () => {});
  let login!: Promise<void>;
  act(() => { login = auth.login("b@example.test", "fixture"); });
  await act(async () => { rejectList(new ApiError(401, "OLD", "A session expired")); });
  await act(async () => {
    resolveLogin({ id: "B", email: "b@example.test" });
    await login;
  });
  expect(auth.status).toBe("authenticated");
  expect(auth.user?.id).toBe("B");
});
