"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { persistReferralCode } from "@/features/referral/lib/referral-storage";

export function ReferralAttributionCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      persistReferralCode(ref);
    }
  }, [searchParams]);

  return null;
}
