import path from "node:path";
import type { NextConfig } from "next";

const adminRoot = __dirname;
const monorepoRoot = path.join(adminRoot, "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@zynd/shared"],
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      // Workspace hoists @zynd/shared to the repo root, but Next stays in Admin/.
      // Pin these to the Admin workspace so dev error overlays don't resolve a
      // mismatched `next` package and surface the misleading Html error.
      next: "./Admin/node_modules/next",
      "react-dom": "./Admin/node_modules/react-dom",
    },
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
