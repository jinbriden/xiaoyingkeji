import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { TaskProvider } from "@/components/TaskProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "素材工坊",
  description: "选择模板，上传图片，异步制作素材",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <TaskProvider>
            <Header />
            <main className="site-main">{children}</main>
          </TaskProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
