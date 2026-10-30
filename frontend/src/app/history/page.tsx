"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { TaskPanel } from "@/components/TaskPanel";

export default function HistoryPage() {
  const { status, reload } = useAuth();

  if (status === "loading") {
    return <p className="state-block">加载中…</p>;
  }
  if (status === "unavailable") {
    return (
      <div className="state-block" role="alert">
        <p>无法连接服务</p>
        <button type="button" className="button button-small" onClick={() => void reload()}>
          重试
        </button>
      </div>
    );
  }
  if (status === "anonymous") {
    return (
      <div className="state-block">
        <p>登录后查看你的制作记录</p>
        <Link href="/login?next=%2Fhistory" className="button button-small">
          去登录
        </Link>
      </div>
    );
  }

  return (
    <TaskPanel
      title="我的记录"
      headingLevel="h1"
      emptyHint={
        <>
          <p>还没有制作记录</p>
          <Link href="/" className="button button-small">
            去选模板
          </Link>
        </>
      }
    />
  );
}
