import type { Asset, Task, Template, User } from "./types";

/** status 为 0 表示请求没有得到服务端响应，例如网络中断或后端不可用。 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const UNREACHABLE_MESSAGE = "无法连接服务，请检查网络后重试";

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  if (typeof body?.message === "string") {
    return new ApiError(response.status, body.code ?? "ERROR", body.message);
  }
  // 代理在后端不可用时返回的 5xx 没有业务错误体
  return new ApiError(response.status, "UNAVAILABLE", UNREACHABLE_MESSAGE);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...init });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, "UNREACHABLE", UNREACHABLE_MESSAGE);
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  me: () => request<User>("/api/auth/me"),
  login: (email: string, password: string) => postJson<User>("/api/auth/login", { email, password }),
  register: (email: string, password: string) => postJson<User>("/api/auth/register", { email, password }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  categories: (signal?: AbortSignal) => request<string[]>("/api/template-categories", { signal }),
  templates: (category: string | null, signal?: AbortSignal) => {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    return request<Template[]>(`/api/templates${query}`, { signal });
  },
  template: (id: string, signal?: AbortSignal) =>
    request<Template>(`/api/templates/${encodeURIComponent(id)}`, { signal }),

  createTask: (templateId: string, assetIds: string[]) => postJson<Task>("/api/tasks", { templateId, assetIds }),
  listTasks: (signal?: AbortSignal) => request<Task[]>("/api/tasks", { signal }),
  fetchTasks: (ids: string[], signal?: AbortSignal) =>
    request<Task[]>(`/api/tasks/batch?ids=${ids.map(encodeURIComponent).join(",")}`, { signal }),
};

/** 上传使用 XMLHttpRequest，因为 fetch 拿不到上传进度。 */
export function uploadAsset(
  templateId: string,
  file: File,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("templateId", templateId);
    form.append("file", file);

    xhr.open("POST", "/api/assets");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      const body = (() => {
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return null;
        }
      })();
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        resolve(body as Asset);
      } else if (typeof body?.message === "string") {
        reject(new ApiError(xhr.status, body.code ?? "ERROR", body.message));
      } else {
        reject(new ApiError(xhr.status, "UNAVAILABLE", UNREACHABLE_MESSAGE));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "UNREACHABLE", UNREACHABLE_MESSAGE));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
