import type { OverviewAllocationSlice } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import type { InvestFundDetail, InvestReturns } from "@/features/invest/api/invest-api";
import { formatSignedReturn } from "@/features/invest/lib/mf-format";
import { mfFundHref } from "@/features/invest/lib/mf-fund-url";
import type { FundsForYouFund } from "@/features/recommendations/types/funds-for-you";
import type { RiskTierId } from "@/features/risk-profile/lib/risk-tier-ui";

/** Blurred placeholder for Portfolio Review when the user has no holdings. */
export const FUNDS_FOR_YOU_PORTFOLIO_LOCKED_VALUE_INR = 4_25_000;

export const FUNDS_FOR_YOU_PORTFOLIO_LOCKED_ALLOCATION: OverviewAllocationSlice[] = [
  { id: "large-cap", label: "Large Cap", valuePct: 38, color: "#38bdf8" },
  { id: "flexi-cap", label: "Flexi Cap", valuePct: 24, color: "#22d3ee" },
  { id: "mid-cap", label: "Mid Cap", valuePct: 18, color: "#fbbf24" },
  { id: "small-cap", label: "Small Cap", valuePct: 12, color: "#c4b5fd" },
  { id: "debt", label: "Debt", valuePct: 6, color: "#34d399" },
  { id: "other", label: "Others", valuePct: 2, color: "#94a3b8" },
];

export const FUNDS_FOR_YOU_FILTER_ALL = "all";

const FILTER_LABELS: Record<string, string> = {
  "large-cap": "Large Cap",
  "mid-cap": "Mid Cap",
  "small-cap": "Small Cap",
  "flexi-cap": "Flexi Cap",
  debt: "Debt",
  "tax-saving": "Tax Saving",
  hybrid: "Hybrid",
  other: "Other",
};

export function categorySlugToFilterId(slug: string | null | undefined): string {
  if (!slug) return "other";
  const normalized = slug.toLowerCase();
  if (normalized.includes("elss") || normalized.includes("tax")) return "tax-saving";
  if (normalized.includes("large")) return "large-cap";
  if (normalized.includes("mid")) return "mid-cap";
  if (normalized.includes("small")) return "small-cap";
  if (normalized.includes("flexi")) return "flexi-cap";
  if (
    normalized.includes("debt") ||
    normalized.includes("liquid") ||
    normalized.includes("gilt") ||
    normalized.includes("income")
  ) {
    return "debt";
  }
  if (normalized.includes("hybrid") || normalized.includes("balanced")) return "hybrid";
  return "other";
}

export function filterIdToLabel(filterId: string): string {
  return FILTER_LABELS[filterId] ?? filterId;
}

export function formatFundCategoryMeta(detail: InvestFundDetail | undefined): string {
  if (!detail) return "Mutual fund";
  const category = detail.category_name ?? detail.sebi_category;
  if (!category) return "Mutual fund";
  if (/equity/i.test(category)) return category;
  return `Equity | ${category}`;
}

export function computeFundsForYouMatchScore(index: number, rankPosition: number | null | undefined) {
  if (rankPosition != null && rankPosition > 0) {
    return Math.min(99, Math.max(82, 100 - Math.floor(rankPosition / 2)));
  }
  return Math.max(85, 97 - index * 3);
}

const FUNDS_FOR_YOU_RETURN_3Y: { key: "return_3y"; shortLabel: "3Y" } = {
  key: "return_3y",
  shortLabel: "3Y",
};

/** Longest horizon fallbacks when 3Y is missing (5Y → 1Y → 6M → 1M). */
const FUNDS_FOR_YOU_RETURN_MAX_HORIZON: Array<{
  key: keyof Pick<InvestReturns, "return_5y" | "return_1y" | "return_6m" | "return_1m">;
  shortLabel: string;
}> = [
  { key: "return_5y", shortLabel: "5Y" },
  { key: "return_1y", shortLabel: "1Y" },
  { key: "return_6m", shortLabel: "6M" },
  { key: "return_1m", shortLabel: "1M" },
];

function isValidReturn(value: number | null | undefined): value is number {
  return value != null && !Number.isNaN(value);
}

export function sparklinePointsFromReturn(returnPct: number): number[] {
  const growth = Math.max(4, Math.min(36, returnPct));
  return Array.from({ length: 10 }, (_, index) => {
    const wave = Math.sin(index * 0.65) * 1.4;
    return 12 + (growth / 10) * index + wave;
  });
}

export type FundsForYouFundReturnDisplay = {
  hasData: boolean;
  shortLabel: string | null;
  text: string;
  tone: "positive" | "negative" | "muted";
  value: number | null;
  sparkPoints: number[];
};

export function resolveFundsForYouFundReturn(
  returns: InvestReturns | undefined,
): FundsForYouFundReturnDisplay {
  if (!returns) {
    return {
      hasData: false,
      shortLabel: null,
      text: "",
      tone: "muted",
      value: null,
      sparkPoints: [],
    };
  }

  const primary = returns[FUNDS_FOR_YOU_RETURN_3Y.key];
  if (isValidReturn(primary)) {
    const formatted = formatSignedReturn(primary);
    return {
      hasData: true,
      shortLabel: FUNDS_FOR_YOU_RETURN_3Y.shortLabel,
      text: formatted.text,
      tone: formatted.tone,
      value: primary,
      sparkPoints: sparklinePointsFromReturn(primary),
    };
  }

  for (const period of FUNDS_FOR_YOU_RETURN_MAX_HORIZON) {
    const value = returns[period.key];
    if (!isValidReturn(value)) continue;
    const formatted = formatSignedReturn(value);
    return {
      hasData: true,
      shortLabel: period.shortLabel,
      text: formatted.text,
      tone: formatted.tone,
      value,
      sparkPoints: sparklinePointsFromReturn(value),
    };
  }

  return {
    hasData: false,
    shortLabel: null,
    text: "",
    tone: "muted",
    value: null,
    sparkPoints: [],
  };
}

export function resolveFundsForYouSortReturnValue(returns: InvestReturns | undefined): number {
  return resolveFundsForYouFundReturn(returns).value ?? -999;
}

export type EnrichedFundsForYouFund = FundsForYouFund & {
  detail?: InvestFundDetail;
  filterId: string;
  filterLabel: string;
  matchScore: number;
  fundReturn: FundsForYouFundReturnDisplay;
};

export function resolveFundsForYouFundHref(
  fund: Pick<FundsForYouFund, "product_slug" | "scheme_name">,
  detail?: InvestFundDetail,
): string {
  if (detail) {
    return mfFundHref(detail);
  }
  return mfFundHref(
    fund.product_slug
      ? { name: fund.scheme_name, slug: fund.product_slug }
      : { name: fund.scheme_name },
  );
}

export function enrichFundsForYouFund(
  fund: FundsForYouFund,
  index: number,
  detailMap: Map<string, InvestFundDetail> | undefined,
): EnrichedFundsForYouFund {
  const detail = detailMap?.get(fund.product_id);
  const filterId = categorySlugToFilterId(detail?.category_slug);
  return {
    ...fund,
    detail,
    filterId,
    filterLabel: filterIdToLabel(filterId),
    matchScore: computeFundsForYouMatchScore(index, detail?.rank_position),
    fundReturn: resolveFundsForYouFundReturn(detail?.returns),
  };
}

const TIER_HORIZON_LABEL: Record<RiskTierId, string> = {
  secure: "1–3 years",
  conservative: "3–5 years",
  moderate: "7–10 years",
  growth: "10+ years",
  aggressive: "10+ years",
};

export function resolveRiskHorizonLabel(tier: string | null | undefined): string {
  if (!tier) return "—";
  const key = tier.toLowerCase() as RiskTierId;
  return TIER_HORIZON_LABEL[key] ?? "5–7 years";
}

export function buildFilterOptions(funds: readonly EnrichedFundsForYouFund[]) {
  const ids = new Set<string>();
  for (const fund of funds) {
    if (fund.filterId !== "other") ids.add(fund.filterId);
  }
  return [...ids]
    .sort((a, b) => filterIdToLabel(a).localeCompare(filterIdToLabel(b)))
    .map((id) => ({ id, label: filterIdToLabel(id) }));
}
