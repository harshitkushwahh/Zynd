import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@zynd/shared"],
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 160, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
