import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async redirects() {
    return [
      { source: "/learn/solid", destination: "/learn/clean-code", permanent: true },
      { source: "/learn/solid/:slug", destination: "/learn/clean-code/:slug", permanent: true },
      { source: "/learn/database-interviews", destination: "/learn/databases", permanent: true },
      { source: "/learn/database-interviews/:slug", destination: "/learn/databases/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
