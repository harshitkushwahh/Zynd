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

const INVEST_ASSETS_PREFIX = "/invest/assets/";

function buildInvestAssetUrl(assetPath: string) {
  const normalized = assetPath.replace(/^\/+/, "");
  return `${env.apiUrl.replace(/\/$/, "")}${INVEST_ASSETS_PREFIX}${normalized}`;
}

/** Resolve AMC logo from API value, falling back to the standard storage path from slug. */
export function resolveAmcLogoUrl(
  logoUrl: string | null | undefined,
  amcSlug: string | null | undefined,
) {
  const resolved = resolveDistributorAssetUrl(logoUrl);
  if (resolved) return resolved;
  if (!amcSlug) return null;
  return buildInvestAssetUrl(`public/amcs/${amcSlug}.png`);
}
