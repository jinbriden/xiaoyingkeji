"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MakerPanel } from "@/components/MakerPanel";
import { TaskPanel } from "@/components/TaskPanel";
import { api, ApiError } from "@/lib/api";
import type { Template } from "@/lib/types";

type DetailState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; template: Template };

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { status: authStatus, user } = useAuth();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    api
      .template(id, controller.signal)
      .then((template) => setState({ status: "ready", template }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: "not-found" });
        } else {
          setState({
            status: "error",
            message: error instanceof ApiError ? error.message : "模板加载失败",
          });
        }
      });
    return () => controller.abort();
  }, [id, attempt]);

  if (state.status === "loading") {
    return <p className="state-block">模板加载中…</p>;
  }
  if (state.status === "not-found") {
    return (
      <div className="state-block">
        <p>模板不存在或已下线</p>
        <Link href="/" className="button button-small">
          返回模板列表
        </Link>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="state-block" role="alert">
        <p>{state.message}</p>
        <button type="button" className="button button-small" onClick={() => setAttempt((value) => value + 1)}>
          重新加载
        </button>
      </div>
    );
  }

  const { template } = state;
  const loginHref = `/login?next=${encodeURIComponent(`/templates/${template.id}`)}`;

  return (
    <div className="maker-layout">
      <section className="maker-panel" aria-labelledby="template-title">
        <div className="maker-title">
          <Link href="/" className="icon-button" aria-label="返回模板列表">
            ‹
          </Link>
          <h1 id="template-title">{template.title}</h1>
        </div>
        <div className="cover-stage">
          <img src={template.coverUrl} alt="" className="cover-backdrop" />
          <img src={template.coverUrl} alt={`${template.title} 示例封面`} className="cover-image" />
        </div>
        <p className="maker-description">{template.description}</p>

        {user ? (
          // 用 key 绑定用户，切换用户时清空上一用户的上传状态
          <MakerPanel key={`${user.id}:${template.id}`} template={template} />
        ) : (
          authStatus !== "loading" && (
            <Link href={loginHref} className="button button-block">
              登录后开始制作
            </Link>
          )
        )}
      </section>

      {user ? (
        <TaskPanel
          title="制作记录"
          templateId={template.id}
          emptyHint={<p>还没有这个模板的任务，上传图片后开始制作</p>}
        />
      ) : (
        <section className="task-panel" aria-label="制作记录">
          <p className="empty-state">登录后可查看制作记录</p>
        </section>
      )}
    </div>
  );
}
