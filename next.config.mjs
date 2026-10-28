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
