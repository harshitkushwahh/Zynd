import { useEffect, useState } from "react";

import {
  fetchInvestSearch,
  type InvestFundSummary,
} from "@/features/invest/api/invest-api";
import { dedupeInvestFunds } from "@/features/invest/lib/mf-fund-ranking";

export const MF_FUND_SEARCH_MIN_CHARS = 2;
export const MF_FUND_SEARCH_DEBOUNCE_MS = 300;
export const MF_FUND_SEARCH_PAGE_SIZE = 8;

type UseMfFundSearchOptions = {
  query: string;
  enabled?: boolean;
  excludeProductIds?: readonly string[];
};

export function useMfFundSearch({
  query,
  enabled = true,
  excludeProductIds = [],
}: UseMfFundSearchOptions) {
  const trimmedQuery = query.trim();
  const [results, setResults] = useState<InvestFundSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excludedKey = excludeProductIds.join(",");

  useEffect(() => {
    if (!enabled || trimmedQuery.length < MF_FUND_SEARCH_MIN_CHARS) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setError(null);
    const excluded = new Set(excludedKey ? excludedKey.split(",") : []);

    const timeout = window.setTimeout(() => {
      fetchInvestSearch({ q: trimmedQuery, page: 1, page_size: MF_FUND_SEARCH_PAGE_SIZE })
        .then((response) => {
          if (!cancelled) {
            setResults(
              dedupeInvestFunds(response.items).filter((item) => !excluded.has(item.product_id)),
            );
          }
        })
        .catch((err: Error) => {
          if (!cancelled) {
            setResults([]);
            setError(err.message);
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, MF_FUND_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [enabled, excludedKey, trimmedQuery]);

  return {
    results,
    searching,
    error,
    trimmedQuery,
    isActive: trimmedQuery.length >= MF_FUND_SEARCH_MIN_CHARS,
  };
}
