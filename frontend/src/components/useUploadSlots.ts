"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, uploadAsset } from "@/lib/api";
import { validateFile } from "@/lib/format";
import type { Template } from "@/lib/types";

export type SlotStatus = "empty" | "uploading" | "ready" | "error";

export interface UploadSlot {
  status: SlotStatus;
  fileName: string | null;
  /** 浏览器本地预览地址，只用于展示，后台任务使用 assetId。 */
  previewUrl: string | null;
  progress: number;
  assetId: string | null;
  error: string | null;
}

const EMPTY_SLOT: UploadSlot = {
  status: "empty",
  fileName: null,
  previewUrl: null,
  progress: 0,
  assetId: null,
  error: null,
};

export function useUploadSlots(template: Template) {
  const [slots, setSlots] = useState<UploadSlot[]>(() => Array(template.requiredImageCount).fill(EMPTY_SLOT));
  const controllers = useRef(new Map<number, AbortController>());
  const previews = useRef(new Map<number, string>());

  const patch = useCallback((index: number, update: Partial<UploadSlot>) => {
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...update } : slot)));
  }, []);

  /** 中止该上传位正在进行的上传，并释放本地预览。 */
  const release = useCallback((index: number) => {
    controllers.current.get(index)?.abort();
    controllers.current.delete(index);
    const preview = previews.current.get(index);
    if (preview) {
      URL.revokeObjectURL(preview);
      previews.current.delete(index);
    }
  }, []);

  const select = useCallback(
    async (index: number, file: File) => {
      release(index);
      const invalid = validateFile(file, template.acceptedMimeTypes, template.maxFileSizeBytes);
      if (invalid) {
        patch(index, { ...EMPTY_SLOT, status: "error", fileName: file.name, error: invalid });
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      previews.current.set(index, previewUrl);
      const controller = new AbortController();
      controllers.current.set(index, controller);
      patch(index, { ...EMPTY_SLOT, status: "uploading", fileName: file.name, previewUrl });

      try {
        const asset = await uploadAsset(
          template.id,
          file,
          (progress) => {
            if (!controller.signal.aborted) {
              patch(index, { progress });
            }
          },
          controller.signal,
        );
        if (!controller.signal.aborted) {
          controllers.current.delete(index);
          patch(index, { status: "ready", progress: 100, assetId: asset.id });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          controllers.current.delete(index);
          patch(index, {
            status: "error",
            error: error instanceof ApiError ? error.message : "上传失败，请重试",
          });
        }
      }
    },
    [patch, release, template],
  );

  const remove = useCallback(
    (index: number) => {
      release(index);
      patch(index, EMPTY_SLOT);
    },
    [patch, release],
  );

  const reset = useCallback(() => {
    for (let index = 0; index < template.requiredImageCount; index += 1) {
      release(index);
    }
    setSlots(Array(template.requiredImageCount).fill(EMPTY_SLOT));
  }, [release, template.requiredImageCount]);

  useEffect(() => {
    const activeControllers = controllers.current;
    const activePreviews = previews.current;
    return () => {
      activeControllers.forEach((controller) => controller.abort());
      activePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  return { slots, select, remove, reset };
}
