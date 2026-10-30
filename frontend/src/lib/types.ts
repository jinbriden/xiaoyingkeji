export type TaskStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
export type StageName = "ASSET_CHECK" | "GENERATE" | "RESULT";

export interface User {
  id: string;
  email: string;
}

export interface Template {
  id: string;
  title: string;
  category: string;
  coverUrl: string;
  description: string;
  requiredImageCount: number;
  acceptedMimeTypes: string[];
  maxFileSizeBytes: number;
}

export interface Asset {
  id: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Task {
  id: string;
  templateId: string;
  templateTitle: string;
  templateCoverUrl: string;
  status: TaskStatus;
  currentStage: StageName | null;
  failureStage: StageName | null;
  failureReason: string | null;
  resultUrl: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export const STAGES: { name: StageName; label: string }[] = [
  { name: "ASSET_CHECK", label: "素材检查" },
  { name: "GENERATE", label: "模拟生成" },
  { name: "RESULT", label: "结果整理" },
];

export function stageLabel(stage: StageName | null): string | null {
  return STAGES.find((item) => item.name === stage)?.label ?? null;
}

export function isTerminal(status: TaskStatus): boolean {
  return status === "SUCCEEDED" || status === "FAILED";
}
