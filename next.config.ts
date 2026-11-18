import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Old Spanish route, kept so existing links keep working.
  async redirects() {
    return [{ source: "/p/:id/nueva", destination: "/p/:id/new", permanent: true }];
  },
  async headers() {
    return [
      {
        // bridge.js is loaded by reviewed apps from another origin
        source: "/bridge.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
