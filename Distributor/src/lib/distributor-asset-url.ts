import { env } from "@/lib/env";

export function resolveDistributorAssetUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return trimmed;

  const apiPrefix = "/api/v1";
  const apiIndex = trimmed.indexOf(apiPrefix);
  if (apiIndex !== -1) {
    return trimmed.slice(apiIndex);
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `${env.apiUrl.replace(/\/$/, "")}/${trimmed.replace(/^\//, "")}`;
}
