"use client";

import { useId, useRef } from "react";
import type { UploadSlot } from "./useUploadSlots";

interface UploadSlotViewProps {
  index: number;
  slot: UploadSlot;
  accept: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

export function UploadSlotView({ index, slot, accept, onSelect, onRemove }: UploadSlotViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const label = `第 ${index + 1} 张图片`;
  const hasFile = slot.previewUrl !== null;

  return (
    <div className={`upload-slot slot-${slot.status}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // 清空后，重新选择同一个文件也能触发 change
          event.target.value = "";
          if (file) {
            onSelect(file);
          }
        }}
      />

      {hasFile ? (
        <img src={slot.previewUrl ?? undefined} alt={`${label}预览`} className="upload-preview" />
      ) : (
        <button
          type="button"
          className="upload-trigger"
          aria-describedby={slot.error ? hintId : undefined}
          onClick={() => inputRef.current?.click()}
        >
          <span className="upload-plus" aria-hidden="true">
            +
          </span>
          <span>上传{label}</span>
        </button>
      )}

      {slot.status === "uploading" && (
        <div className="upload-overlay" role="status">
          上传中 {slot.progress}%
          <progress max={100} value={slot.progress} aria-label={`${label}上传进度`} />
        </div>
      )}
      {slot.status === "ready" && <span className="upload-ready">已上传</span>}
      {slot.error && (
        <p id={hintId} className="upload-error" role="alert">
          {slot.error}
        </p>
      )}

      {(hasFile || slot.status === "error") && (
        <div className="upload-actions">
          <button type="button" className="chip-button" aria-label={`替换${label}`} onClick={() => inputRef.current?.click()}>
            替换
          </button>
          <button type="button" className="chip-button" aria-label={`移除${label}`} onClick={onRemove}>
            移除
          </button>
        </div>
      )}
    </div>
  );
}
