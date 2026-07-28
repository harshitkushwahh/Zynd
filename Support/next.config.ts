import path from "node:path";
import type { NextConfig } from "next";

const supportRoot = __dirname;
const monorepoRoot = path.join(supportRoot, "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@zynd/shared"],
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      next: "./Support/node_modules/next",
      "react-dom": "./Support/node_modules/react-dom",
    },
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
