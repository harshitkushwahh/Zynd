import type { InvestFundSummary } from "@/features/invest/api/invest-api";

export function slugifyFundName(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

type FundSlugSource = Pick<InvestFundSummary, "name"> & {
  slug?: string;
  content?: { seo_slug?: string | null } | null;
};

export function mfFundSlug(fund: FundSlugSource): string {
  return fund.slug ?? fund.content?.seo_slug ?? slugifyFundName(fund.name);
}

export function mfFundHref(fund: FundSlugSource): string {
  return `/dashboard/mutual-funds/funds/${encodeURIComponent(mfFundSlug(fund))}`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isFundUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
