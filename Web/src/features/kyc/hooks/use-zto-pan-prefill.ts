"use client";

import { useEffect, useRef, useState } from "react";

import type { KycPanDraft } from "@/features/kyc/lib/kyc-api";
import { fetchZtoReviewData } from "@/features/kyc/lib/zto-api";
import { mapApprovedZtoToPanPrefill } from "@/features/kyc/lib/zto-prefill";

/**
 * One-time read of the user-approved ZTO snapshot for PAN step input seeding.
 * Read-only: never writes journey state and never marks any step verified.
 */
export function useZtoPanPrefill(enabled: boolean): KycPanDraft | null {
  const [prefill, setPrefill] = useState<KycPanDraft | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!enabled || requestedRef.current) return;
    requestedRef.current = true;
    void fetchZtoReviewData()
      .then((data) => setPrefill(mapApprovedZtoToPanPrefill(data.approved)))
      .catch(() => setPrefill(null));
  }, [enabled]);

  return prefill;
}
