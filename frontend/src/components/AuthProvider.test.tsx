import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { User } from "@/lib/types";

const controls = vi.hoisted(() => ({ me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()), api: controls,
}));
import { ApiError } from "@/lib/api";
import { AuthProvider, useAuth } from "./AuthProvider";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const A: User = { id: "A", email: "a@example.test" };
const B: User = { id: "B", email: "b@example.test" };
let auth: ReturnType<typeof useAuth>;
function Harness() {
  auth = useAuth();
  return <span data-testid="identity">{auth.status}:{auth.user?.id ?? "none"}</span>;
}
beforeEach(() => {
  for (const mock of Object.values(controls)) mock.mockReset();
  controls.login.mockResolvedValue(B);
  controls.register.mockResolvedValue(B);
  controls.logout.mockResolvedValue(undefined);
});
afterEach(cleanup);

it.each(["401", "network", "success"])("initial me %s cannot replace a newer login", async (outcome) => {
  const pending = deferred<User>();
  controls.me.mockReturnValue(pending.promise);
  const view = render(<AuthProvider><Harness /></AuthProvider>);
  await act(async () => { await auth.login(B.email, "fixture"); });
  expect(view.getByTestId("identity")).toHaveTextContent("authenticated:B");
  await act(async () => {
    if (outcome === "success") pending.resolve(A);
    else pending.reject(new ApiError(outcome === "401" ? 401 : 0, "OLD", "old response"));
  });
  expect(view.getByTestId("identity")).toHaveTextContent("authenticated:B");
});

it("StrictMode's first me effect cannot replace the second effect", async () => {
  const first = deferred<User>();
  controls.me.mockReturnValueOnce(first.promise).mockResolvedValueOnce(B);
  const view = render(<StrictMode><AuthProvider><Harness /></AuthProvider></StrictMode>);
  await act(async () => {});
  expect(controls.me).toHaveBeenCalledTimes(2);
  expect(view.getByTestId("identity")).toHaveTextContent("authenticated:B");
  await act(async () => { first.resolve(A); });
  expect(view.getByTestId("identity")).toHaveTextContent("authenticated:B");
});

it.each(["login", "register"] as const)("late %s success cannot undo logout", async (method) => {
  controls.me.mockResolvedValue(A);
  const pending = deferred<User>();
  controls[method].mockReturnValue(pending.promise);
  const view = render(<AuthProvider><Harness /></AuthProvider>);
  await act(async () => {});
  let request!: Promise<void>;
  act(() => { request = auth[method](B.email, "fixture"); });
  await act(async () => { await auth.logout(); });
  await act(async () => { pending.resolve(B); await request; });
  expect(view.getByTestId("identity")).toHaveTextContent("anonymous:none");
});

it("late logout success cannot clear a newer login", async () => {
  controls.me.mockResolvedValue(A);
  const pending = deferred<void>();
  controls.logout.mockReturnValue(pending.promise);
  const view = render(<AuthProvider><Harness /></AuthProvider>);
  await act(async () => {});
  let request!: Promise<void>;
  act(() => { request = auth.logout(); });
  await act(async () => { await auth.login(B.email, "fixture"); });
  await act(async () => { pending.resolve(); await request; });
  expect(view.getByTestId("identity")).toHaveTextContent("authenticated:B");
});

it.each(["login", "register", "logout"] as const)("obsolete %s error is not surfaced over a newer identity", async (method) => {
  controls.me.mockResolvedValue(A);
  const pending = deferred<never>();
  controls[method].mockReturnValue(pending.promise);
  const view = render(<AuthProvider><Harness /></AuthProvider>);
  await act(async () => {});
  let request!: Promise<void>;
  act(() => { request = auth[method](B.email, "fixture"); });
  // Attach immediately, so a regression does not create an unhandled rejection.
  const outcome = request.then(() => "ignored", () => "surfaced");
  controls.me.mockResolvedValue(B);
  await act(async () => { await auth.reload(); });
  await act(async () => { pending.reject(new ApiError(401, "OLD", "stale failure")); });
  expect(await outcome).toBe("ignored");
  expect(view.getByTestId("identity")).toHaveTextContent("authenticated:B");
});

it("explicit expiry invalidates a pending authentication success", async () => {
  const pending = deferred<User>();
  controls.me.mockReturnValue(pending.promise);
  const view = render(<AuthProvider><Harness /></AuthProvider>);
  act(() => auth.expire());
  await act(async () => { pending.resolve(A); });
  expect(view.getByTestId("identity")).toHaveTextContent("anonymous:none");
});

it.each(["login", "register", "logout"] as const)("a current %s failure settles superseded initial loading and remains visible to its caller", async (method) => {
  const initial = deferred<User>();
  controls.me.mockReturnValue(initial.promise);
  const error = new ApiError(503, "UNAVAILABLE", "current failure");
  controls[method].mockRejectedValue(error);
  const view = render(<AuthProvider><Harness /></AuthProvider>);
  await act(async () => {
    await expect(auth[method](B.email, "fixture")).rejects.toBe(error);
  });
  expect(view.getByTestId("identity")).toHaveTextContent("unavailable:none");
  await act(async () => { initial.resolve(A); });
  expect(view.getByTestId("identity")).toHaveTextContent("unavailable:none");
});
