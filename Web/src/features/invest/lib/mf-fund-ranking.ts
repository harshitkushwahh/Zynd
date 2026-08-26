import type { SortDescriptor } from "react-aria-components";

import { fetchInvestFunds, type InvestFundSummary } from "@/features/invest/api/invest-api";

/** Number of funds surfaced per category on the browse home page. */
export const MF_TOP_FUNDS_PER_CATEGORY = 5;

/** Page size for infinite scroll on the all-funds table. */
export const MF_ALL_FUNDS_PAGE_SIZE = 40;

/** Default all-funds table sort (matches server `return_3y` ordering). */
export const MF_FUNDS_TABLE_DEFAULT_SORT: SortDescriptor = {
  column: "return_3y",
  direction: "descending",
};

export type InvestFundsApiSort = "rank" | "return_3y" | "name";

export function resolveInvestFundsApiSort(sort: SortDescriptor): InvestFundsApiSort | null {
  if (sort.column === "return_3y" && sort.direction === "descending") {
    return "return_3y";
  }
  if (sort.column === "name" && sort.direction === "ascending") {
    return "name";
  }
  return null;
}

export function usesServerFundTableSort(
  sort: SortDescriptor,
  options?: { categoryFiltered?: boolean },
): boolean {
  if (options?.categoryFiltered) return false;
  return resolveInvestFundsApiSort(sort) != null;
}

export function sortFundTableRows<T extends InvestFundSummary>(
  rows: T[],
  sort: SortDescriptor,
): T[] {
  if (usesServerFundTableSort(sort)) return rows;

  const column = sort.column;
  const direction = sort.direction === "descending" ? -1 : 1;

  return [...rows].sort((a, b) => {
    if (column === "name") {
      return a.name.localeCompare(b.name) * direction;
    }
    if (column === "category") {
      return displayCategoryLabel(a).localeCompare(displayCategoryLabel(b)) * direction;
    }
    if (column === "return_1y" || column === "return_3y" || column === "return_5y") {
      const key = column as "return_1y" | "return_3y" | "return_5y";
      const first = a.returns[key] ?? Number.NEGATIVE_INFINITY;
      const second = b.returns[key] ?? Number.NEGATIVE_INFINITY;
      return (first - second) * direction;
    }
    return 0;
  });
}

/** Keep screener-queued funds visible at the top while preserving order within each group. */
export function pinScreenerSelectedFundTableRows<T extends InvestFundSummary>(
  rows: T[],
  selectedProductIds: readonly string[],
): T[] {
  if (selectedProductIds.length === 0) return rows;

  const selectedSet = new Set(selectedProductIds);
  const rowById = new Map(rows.map((row) => [row.product_id, row]));
  const pinned: T[] = [];

  for (const productId of selectedProductIds) {
    const row = rowById.get(productId);
    if (row) pinned.push(row);
  }

  if (pinned.length === 0) return rows;

  const rest = rows.filter((row) => !selectedSet.has(row.product_id));
  return [...pinned, ...rest];
}

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

/** Stop infinite scroll when the API repeats rows or returns an empty page. */
export function resolveInvestFundsPageHasMore(
  append: boolean,
  previousCount: number,
  mergedCount: number,
  responseHasMore: boolean,
  incomingCount: number,
): boolean {
  if (!responseHasMore || incomingCount === 0) return false;
  if (append && mergedCount <= previousCount) return false;
  return true;
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
