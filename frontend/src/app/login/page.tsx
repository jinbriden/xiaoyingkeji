"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";

/** 只允许跳转站内路径，防止 next 参数被用作开放重定向。 */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = safeNext(searchParams.get("next"));

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(next);
    }
  }, [status, router, next]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await (mode === "login" ? login : register)(email, password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "操作失败，请重试");
      setSubmitting(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <h1 id="auth-title">{isLogin ? "登录" : "注册账号"}</h1>
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">邮箱</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">密码（至少 8 位）</span>
          <input
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button-block" disabled={submitting}>
          {submitting ? "请稍候…" : isLogin ? "登录" : "注册并登录"}
        </button>
      </form>
      <button
        type="button"
        className="link-button auth-switch"
        onClick={() => {
          setMode(isLogin ? "register" : "login");
          setError(null);
        }}
      >
        {isLogin ? "没有账号？去注册" : "已有账号？去登录"}
      </button>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
