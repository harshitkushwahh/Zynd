import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@zynd/shared"],
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
