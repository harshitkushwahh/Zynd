import { fetchInvestFunds, type InvestFundSummary } from "@/features/invest/api/invest-api";

/** Number of funds surfaced per category on the browse home page. */
export const MF_TOP_FUNDS_PER_CATEGORY = 5;

/** Page size for infinite scroll on the all-funds table. */
export const MF_ALL_FUNDS_PAGE_SIZE = 40;

/** Keep the first occurrence when the API returns duplicate product rows. */
export function dedupeInvestFunds(funds: InvestFundSummary[]): InvestFundSummary[] {
  const seen = new Set<string>();
  const deduped: InvestFundSummary[] = [];

  for (const fund of funds) {
    if (seen.has(fund.product_id)) continue;
    seen.add(fund.product_id);
    deduped.push(fund);
  }

  return deduped;
}

export function mergeInvestFunds(
  current: InvestFundSummary[],
  incoming: InvestFundSummary[],
): InvestFundSummary[] {
  const seen = new Set(current.map((fund) => fund.product_id));
  const merged = [...current];

  for (const fund of incoming) {
    if (seen.has(fund.product_id)) continue;
    seen.add(fund.product_id);
    merged.push(fund);
  }

  return merged;
}

/**
 * Top funds within a category: composite rank first, then 3Y return, then name
 * (matches backend `list_invest_funds` with `category` + `sort=rank`).
 */
export async function fetchTopFundsForCategory(categorySlug: string, limit = MF_TOP_FUNDS_PER_CATEGORY) {
  const response = await fetchInvestFunds({
    category: categorySlug,
    page: 1,
    page_size: limit,
    sort: "rank",
  });
  return response.items;
}

export function displayCategoryLabel(fund: InvestFundSummary) {
  return fund.sebi_category ?? "—";
}
