"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatFileSize, formatMimeTypes } from "@/lib/format";
import type { Template } from "@/lib/types";
import { useTaskTracker } from "./TaskProvider";
import { UploadSlotView } from "./UploadSlotView";
import { useUploadSlots } from "./useUploadSlots";

export function MakerPanel({ template }: { template: Template }) {
  const tracker = useTaskTracker();
  const { slots, select, remove, reset } = useUploadSlots(template);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const uploading = slots.some((slot) => slot.status === "uploading");
  const readyCount = slots.filter((slot) => slot.status === "ready").length;
  const missing = template.requiredImageCount - readyCount;
  const canSubmit = missing === 0 && !submitting;

  let buttonLabel = "开始制作";
  if (submitting) {
    buttonLabel = "提交中…";
  } else if (uploading) {
    buttonLabel = "素材上传中…";
  } else if (missing > 0) {
    buttonLabel = `还需上传 ${missing} 张图片`;
  }

  const handleSubmit = async () => {
    if (submittingRef.current || !canSubmit) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setNotice("");
    const acceptTask = tracker.captureSubmission();
    try {
      const assetIds = slots.map((slot) => slot.assetId as string);
      const task = await api.createTask(template.id, assetIds);
      if (!acceptTask(task)) {
        return;
      }
      reset();
      setNotice("任务已提交，可以继续制作或离开页面");
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "提交失败，请重试");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="upload-grid" data-count={template.requiredImageCount}>
        {slots.map((slot, index) => (
          <UploadSlotView
            key={index}
            index={index}
            slot={slot}
            accept={template.acceptedMimeTypes.join(",")}
            onSelect={(file) => void select(index, file)}
            onRemove={() => remove(index)}
          />
        ))}
      </div>
      <p className="requirement">
        需要 {template.requiredImageCount} 张图片，支持 {formatMimeTypes(template.acceptedMimeTypes)}，单张不超过{" "}
        {formatFileSize(template.maxFileSizeBytes)}
      </p>
      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}
      <p className="form-notice" role="status">
        {notice}
      </p>
      <button
        type="button"
        className="button button-block"
        disabled={!canSubmit}
        aria-busy={submitting}
        onClick={handleSubmit}
      >
        {buttonLabel}
      </button>
    </>
  );
}
