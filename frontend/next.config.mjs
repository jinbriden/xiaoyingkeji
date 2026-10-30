const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // 浏览器只访问 Next.js 同源地址，避免 CORS，也让 HttpOnly cookie 自然带上。
  // rewrites 在构建时固化，Docker 镜像通过构建参数传入 BACKEND_URL。
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
