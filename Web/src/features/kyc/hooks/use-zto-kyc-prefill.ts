"use client";

import { useEffect, useRef, useState } from "react";

import type { KycPanDraft } from "@/features/kyc/lib/kyc-api";
import type { KycAddressFormValue } from "@/features/kyc/lib/kyc-address";
import type { KycBankFormValue } from "@/features/kyc/lib/kyc-bank";
import { fetchZtoReviewData } from "@/features/kyc/lib/zto-api";
import {
  mapApprovedZtoToAddressPrefill,
  mapApprovedZtoToBankPrefill,
  mapApprovedZtoToPanPrefill,
} from "@/features/kyc/lib/zto-prefill";

export type ZtoKycPrefill = {
  pan: KycPanDraft | null;
  bank: KycBankFormValue | null;
  address: KycAddressFormValue | null;
};

/**
 * One-time read of the user-approved ZTO snapshot for KYC wizard input seeding.
 * Read-only: never writes journey state and never marks any step verified.
 */
export function useZtoKycPrefill(enabled: boolean): ZtoKycPrefill {
  const [prefill, setPrefill] = useState<ZtoKycPrefill>({ pan: null, bank: null, address: null });
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!enabled || requestedRef.current) return;
    requestedRef.current = true;
    void fetchZtoReviewData()
      .then((data) => ({
        pan: mapApprovedZtoToPanPrefill(data.approved),
        bank: mapApprovedZtoToBankPrefill(data.approved),
        address: mapApprovedZtoToAddressPrefill(data.approved),
      }))
      .then(setPrefill)
      .catch(() => setPrefill({ pan: null, bank: null, address: null }));
  }, [enabled]);

  return prefill;
}
