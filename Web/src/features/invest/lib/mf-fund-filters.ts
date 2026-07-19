import type { InvestCategory, InvestFundSummary } from "@/features/invest/api/invest-api";

export type MfFundPillFilter = "index_only" | "flexi_cap" | "sectoral" | "large_cap";

export type MfFundFilters = {
  categorySlug: string | null;
  amcSlugs: string[];
  pills: MfFundPillFilter[];
};

export const MF_FUND_PILL_OPTIONS: Array<{ id: MfFundPillFilter; label: string }> = [
  { id: "index_only", label: "Index only" },
  { id: "flexi_cap", label: "Flexi Cap" },
  { id: "sectoral", label: "Sectoral" },
  { id: "large_cap", label: "Large Cap" },
];

export const EMPTY_MF_FUND_FILTERS: MfFundFilters = {
  categorySlug: null,
  amcSlugs: [],
  pills: [],
};

function haystack(fund: InvestFundSummary) {
  return `${fund.name} ${fund.sebi_category ?? ""} ${fund.display?.risk_label ?? ""}`.toLowerCase();
}

function matchesPill(fund: InvestFundSummary, pill: MfFundPillFilter) {
  const text = haystack(fund);
  switch (pill) {
    case "index_only":
      return text.includes("index");
    case "flexi_cap":
      return text.includes("flexi cap") || text.includes("flexicap");
    case "sectoral":
      return text.includes("sectoral") || text.includes("thematic");
    case "large_cap":
      return text.includes("large cap") || text.includes("largecap");
    default:
      return true;
  }
}

export function applyMfFundFilters(funds: InvestFundSummary[], filters: MfFundFilters) {
  return funds.filter((fund) => {
    if (filters.categorySlug && fund.category_slug !== filters.categorySlug) {
      return false;
    }

    if (filters.amcSlugs.length > 0) {
      if (!fund.amc_slug || !filters.amcSlugs.includes(fund.amc_slug)) {
        return false;
      }
    }

    for (const pill of filters.pills) {
      if (!matchesPill(fund, pill)) {
        return false;
      }
    }

    return true;
  });
}

export function collectFilterOptions(funds: InvestFundSummary[], categories: InvestCategory[]) {
  const amcs = new Map<string, string>();

  for (const fund of funds) {
    if (fund.amc_slug) amcs.set(fund.amc_slug, fund.amc_name);
  }

  return {
    categories,
    amcs: [...amcs.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function hasClientOnlyMfFundFilters(filters: MfFundFilters) {
  return filters.amcSlugs.length > 0 || filters.pills.length > 0;
}

export function hasActiveMfFundFilters(filters: MfFundFilters) {
  return Boolean(filters.categorySlug) || filters.amcSlugs.length > 0 || filters.pills.length > 0;
}

export function toggleMfFundPill(pills: MfFundPillFilter[], pill: MfFundPillFilter) {
  return pills.includes(pill) ? pills.filter((item) => item !== pill) : [...pills, pill];
}
