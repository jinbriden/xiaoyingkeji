"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { isTerminal } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { useTasks } from "./TaskProvider";

export function Header() {
  const { status, user, logout } = useAuth();
  const { tasks } = useTasks();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const activeCount = tasks.filter((task) => !isTerminal(task.status)).length;

  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await logout();
      dialogRef.current?.close();
    } catch {
      setLogoutError("退出失败，请稍后重试");
    }
  };

  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="素材工坊首页">
        <span className="brand-mark" aria-hidden="true">
          S
        </span>
        <span>素材工坊</span>
      </Link>
      <nav className="site-nav" aria-label="主导航">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          模板
        </Link>
        <Link href="/history" aria-current={pathname === "/history" ? "page" : undefined}>
          我的记录
          {activeCount > 0 && (
            <span className="nav-badge" aria-label={`${activeCount} 个任务进行中`}>
              {activeCount}
            </span>
          )}
        </Link>
      </nav>
      <div className="header-account">
        {user ? (
          <button
            type="button"
            className="avatar-button"
            aria-label={`账户：${user.email}`}
            onClick={() => dialogRef.current?.showModal()}
          >
            {user.email.charAt(0).toUpperCase()}
          </button>
        ) : (
          status !== "loading" && (
            <Link href="/login" className="button button-small">
              登录
            </Link>
          )
        )}
      </div>

      <dialog ref={dialogRef} className="dialog" aria-labelledby="account-title">
        <div className="dialog-header">
          <h2 id="account-title">账户</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭账户窗口"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="account-card">
          <span className="avatar-large" aria-hidden="true">
            {user?.email.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="field-label">邮箱</p>
            <p className="account-email">{user?.email}</p>
          </div>
        </div>
        {logoutError && (
          <p className="form-error" role="alert">
            {logoutError}
          </p>
        )}
        <button type="button" className="button button-secondary button-block" onClick={handleLogout}>
          退出登录
        </button>
      </dialog>
    </header>
  );
}
