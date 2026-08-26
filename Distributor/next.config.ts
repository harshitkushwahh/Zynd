import path from "node:path";
import type { NextConfig } from "next";

const distributorRoot = __dirname;
const monorepoRoot = path.join(distributorRoot, "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@zynd/shared"],
  images: {
    localPatterns: [
      {
        pathname: "/api/v1/documents/public/**",
      },
      {
        pathname: "/**",
        search: "",
      },
    ],
  },
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      next: "./Distributor/node_modules/next",
      "react-dom": "./Distributor/node_modules/react-dom",
    },
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
