"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchReferralList, fetchReferralMe } from "@/features/referral/api/referral-api";
import {
  isReferralListPath,
  isReferralPath,
} from "@/features/referral/lib/referral-navigation";

export function useReferralNavbarMeta(pathname: string) {
  const isReferralSection = isReferralPath(pathname);
  const isReferralsListPage = isReferralListPath(pathname);
  const [refereeCount, setRefereeCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isReferralSection) {
      setRefereeCount(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (isReferralsListPage) {
        const list = await fetchReferralList();
        setRefereeCount(list.items.length);
      } else {
        const me = await fetchReferralMe();
        setRefereeCount(me.signup_count);
      }
    } catch {
      setRefereeCount(null);
    } finally {
      setLoading(false);
    }
  }, [isReferralSection, isReferralsListPage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isReferralSection) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isReferralSection, refresh]);

  return {
    isReferralSection,
    isReferralsListPage,
    refereeCount,
    loading,
  };
}
