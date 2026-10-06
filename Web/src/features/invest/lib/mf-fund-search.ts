import { useEffect, useState } from "react";

import {
  fetchInvestSearch,
  type InvestFundSummary,
} from "@/features/invest/api/invest-api";
import { dedupeInvestFunds } from "@/features/invest/lib/mf-fund-ranking";

export const MF_FUND_SEARCH_MIN_CHARS = 2;
export const MF_FUND_SEARCH_DEBOUNCE_MS = 300;
export const MF_FUND_SEARCH_PAGE_SIZE = 8;
export const MF_FUND_MIN_SIP_SEARCH_PAGE_SIZE = 20;

const MIN_SIP_SEARCH_MAX_INR = 10_000_000;

/** Parses global-search amounts like `100`, `100rs`, `5000`, `₹500`. */
export function parseMinSipSearchAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/₹/g, "")
    .replace(/\s+/g, "");

  const match =
    normalized.match(/^(\d+(?:\.\d+)?)(?:rs|rs\.|inr)?$/) ??
    normalized.match(/^(?:rs|inr)(\d+(?:\.\d+)?)$/);

  if (!match?.[1]) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value > MIN_SIP_SEARCH_MAX_INR) {
    return null;
  }

  return Math.round(value);
}

type UseMfFundSearchOptions = {
  query: string;
  maxMinSipInr?: number | null;
  enabled?: boolean;
  excludeProductIds?: readonly string[];
};

export function useMfFundSearch({
  query,
  maxMinSipInr = null,
  enabled = true,
  excludeProductIds = [],
}: UseMfFundSearchOptions) {
  const trimmedQuery = query.trim();
  const minSipActive = maxMinSipInr != null && maxMinSipInr > 0;
  const [results, setResults] = useState<InvestFundSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excludedKey = excludeProductIds.join(",");

  useEffect(() => {
    if (!enabled || (!minSipActive && trimmedQuery.length < MF_FUND_SEARCH_MIN_CHARS)) {
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
      fetchInvestSearch({
        q: minSipActive ? "" : trimmedQuery,
        page: 1,
        page_size: minSipActive ? MF_FUND_MIN_SIP_SEARCH_PAGE_SIZE : MF_FUND_SEARCH_PAGE_SIZE,
        max_min_sip_inr: minSipActive ? maxMinSipInr : undefined,
      })
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
  }, [enabled, excludedKey, maxMinSipInr, minSipActive, trimmedQuery]);

  return {
    results,
    searching,
    error,
    trimmedQuery,
    isActive: minSipActive || trimmedQuery.length >= MF_FUND_SEARCH_MIN_CHARS,
    minSipActive,
  };
}
