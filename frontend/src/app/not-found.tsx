import Link from "next/link";

export default function NotFound() {
  return (
    <div className="state-block">
      <p>页面不存在</p>
      <Link href="/" className="button button-small">
        返回首页
      </Link>
    </div>
  );
}
