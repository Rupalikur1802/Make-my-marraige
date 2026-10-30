/** @type {import("next").NextConfig} */

const nextConfig = {
  agentRules: false,
  serverExternalPackages: ["@node-rs/argon2", "mongoose"],
  async headers() {
    return [
      "/login",
      "/workspace",
      "/wedding/:path*",
      "/api/wedding",
      "/ceremonies/:path*",
      "/api/events/:path*",
      "/families/:path*",
      "/api/families/:path*",
      "/attendance",
      "/api/attendance",
      "/api/dashboard",
      "/tasks/:path*",
      "/api/tasks/:path*",
      "/expenses/:path*",
      "/api/expenses/:path*",
      "/photos/:path*",
      "/api/photos/:path*",
      "/invite",
      "/guest/:path*",
      "/api/guest/:path*",
      "/api/auth/:path*",
    ].map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex" },
      ],
    }));
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
