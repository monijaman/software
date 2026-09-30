import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async redirects() {
    return [
      { source: "/learn/solid", destination: "/learn/clean-code", permanent: true },
      { source: "/learn/solid/:slug", destination: "/learn/clean-code/:slug", permanent: true },
      { source: "/learn/database-interviews", destination: "/learn/databases", permanent: true },
      { source: "/learn/database-interviews/:slug", destination: "/learn/databases/:slug", permanent: true },
      ...[
        ["containers-network-data-and-secrets", "containers-ecr-and-ecs"],
        ["edge-identity-observability-and-ci", "cloudfront-and-static-sites"],
      ].map(([from, to]) => ({
        source: `/learn/aws/${from}`,
        destination: `/learn/aws/${to}`,
        permanent: true,
      })),
      ...[
        ["javascript-and-typescript", "javascript-language-fundamentals"],
        ["node-express-and-nestjs", "nodejs-and-express"],
        ["python-for-automation-and-apis", "python-fundamentals"],
        ["go-concurrency-and-services", "go-concurrency"],
        ["rust-safety-and-performance", "rust-ownership-and-borrowing"],
      ].map(([from, to]) => ({
        source: `/learn/programming-languages/${from}`,
        destination: `/learn/programming-languages/${to}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
