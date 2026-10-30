const dateTimeFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
}

export function formatMimeTypes(types: string[]): string {
  return types.map((type) => type.replace("image/", "").toUpperCase()).join(" / ");
}

/** 返回客户端校验错误，通过时返回 null。服务端会再次校验。 */
export function validateFile(file: File, acceptedMimeTypes: string[], maxFileSizeBytes: number): string | null {
  if (!acceptedMimeTypes.includes(file.type)) {
    return `仅支持 ${formatMimeTypes(acceptedMimeTypes)} 格式`;
  }
  if (file.size > maxFileSizeBytes) {
    return `图片不能超过 ${formatFileSize(maxFileSizeBytes)}`;
  }
  return null;
}
