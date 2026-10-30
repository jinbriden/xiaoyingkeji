import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { TaskTracker } from "@/lib/taskTracker";
import type { Task, Template } from "@/lib/types";

const controls = vi.hoisted(() => ({ createTask: vi.fn(), tracker: null as unknown, reset: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { createTask: controls.createTask },
}));
vi.mock("./TaskProvider", () => ({ useTaskTracker: () => controls.tracker }));
vi.mock("./useUploadSlots", () => ({
  useUploadSlots: () => ({
    slots: [{ status: "ready", assetId: "fixture-asset" }],
    select: vi.fn(), remove: vi.fn(), reset: controls.reset,
  }),
}));
vi.mock("./UploadSlotView", () => ({ UploadSlotView: () => null }));
import { MakerPanel } from "./MakerPanel";

const template: Template = {
  id: "fixture-template", title: "fixture", category: "fixture", coverUrl: "", description: "",
  requiredImageCount: 1, acceptedMimeTypes: ["image/png"], maxFileSizeBytes: 5242880,
};
const accepted: Task = {
  id: "A-delayed-task", templateId: template.id, templateTitle: "A private fixture", templateCoverUrl: "",
  status: "PENDING", currentStage: null, failureStage: null, failureReason: null, resultUrl: null,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", finishedAt: null,
};
let tracker: TaskTracker;
let resolve: (task: Task) => void;
beforeEach(async () => {
  controls.createTask.mockReset().mockReturnValue(new Promise<Task>((res) => { resolve = res; }));
  controls.reset.mockReset();
  tracker = new TaskTracker({ listTasks: async () => [], fetchTasks: async () => [] }, { intervalMs: 60000 });
  controls.tracker = tracker;
  tracker.start("A");
  await act(async () => {});
});
afterEach(() => { cleanup(); tracker.stop(); });

it.each(["B", "A-again", "logout"])("delayed acceptance cannot enter a replacement session: %s", async (destination) => {
  const view = render(<StrictMode><MakerPanel template={template} /></StrictMode>);
  fireEvent.click(view.getByRole("button", { name: "开始制作" }));
  expect(controls.createTask).toHaveBeenCalledOnce();
  view.unmount();
  if (destination === "logout") tracker.stop();
  else {
    tracker.start("B");
    if (destination === "A-again") tracker.start("A");
  }
  await act(async () => { resolve(accepted); });
  expect(tracker.getSnapshot().tasks).toEqual([]);
});

it("keeps tracking an accepted task after same-user navigation in StrictMode", async () => {
  const view = render(<StrictMode><MakerPanel template={template} /></StrictMode>);
  fireEvent.click(view.getByRole("button", { name: "开始制作" }));
  view.unmount();
  await act(async () => { resolve(accepted); });
  expect(tracker.getSnapshot().tasks).toEqual([accepted]);
});
