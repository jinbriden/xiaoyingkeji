"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Template } from "@/lib/types";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; templates: Template[] };

function TemplateGallery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");

  const [categories, setCategories] = useState<string[]>([]);
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    Promise.all([api.categories(controller.signal), api.templates(category, controller.signal)])
      .then(([nextCategories, templates]) => {
        setCategories(nextCategories);
        setState({ status: "ready", templates });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message: error instanceof ApiError ? error.message : "模板加载失败",
          });
        }
      });
    return () => controller.abort();
  }, [category, attempt]);

  const selectCategory = (next: string | null) => {
    router.replace(next ? `${pathname}?category=${encodeURIComponent(next)}` : pathname, { scroll: false });
  };

  return (
    <>
      <h1 className="visually-hidden">素材模板</h1>
      <div className="category-tabs" role="group" aria-label="模板分类">
        {[null, ...categories].map((item) => (
          <button
            key={item ?? "all"}
            type="button"
            className="category-tab"
            aria-pressed={category === item}
            onClick={() => selectCategory(item)}
          >
            {item ?? "全部"}
          </button>
        ))}
      </div>

      {state.status === "loading" && (
        <div className="template-grid" aria-busy="true" aria-label="模板加载中">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="template-skeleton" />
          ))}
        </div>
      )}
      {state.status === "error" && (
        <div className="state-block" role="alert">
          <p>{state.message}</p>
          <button type="button" className="button button-small" onClick={retry}>
            重新加载
          </button>
        </div>
      )}
      {state.status === "ready" && state.templates.length === 0 && (
        <div className="state-block">
          <p>这个分类下还没有模板</p>
        </div>
      )}
      {state.status === "ready" && state.templates.length > 0 && (
        <div className="template-grid">
          {state.templates.map((template) => (
            <Link key={template.id} href={`/templates/${template.id}`} className="template-card">
              <img src={template.coverUrl} alt="" loading="lazy" />
              <span className="template-title">{template.title}</span>
              <span className="template-count">{template.requiredImageCount} 张图片</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <TemplateGallery />
    </Suspense>
  );
}
