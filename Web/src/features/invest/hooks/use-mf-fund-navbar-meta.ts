"use client";

import { useEffect, useState } from "react";

import { fetchInvestFundDetail, type InvestFundDetail } from "@/features/invest/api/invest-api";

const FUND_DETAIL_PATH = /^\/dashboard\/mutual-funds\/funds\/([^/?#]+)/;

export function extractMfFundSlug(pathname: string): string | null {
  const match = pathname.match(FUND_DETAIL_PATH);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function useMfFundNavbarMeta(pathname: string) {
  const fundSlug = extractMfFundSlug(pathname);
  const [fund, setFund] = useState<InvestFundDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fundSlug) {
      setFund(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchInvestFundDetail(fundSlug)
      .then((data) => {
        if (!cancelled) setFund(data);
      })
      .catch(() => {
        if (!cancelled) setFund(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fundSlug]);

  return { fund, loading, isFundPage: Boolean(fundSlug) };
}
