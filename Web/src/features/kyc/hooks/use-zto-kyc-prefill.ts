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

const KYC_DIALOG_CLOSE_RESET_MS = 220;

/**
 * Read-only ZTO snapshot for KYC wizard seeding (never writes journey state).
 * Fetches while the dialog is open and ZTO was accepted; clears after close.
 */
export function useZtoKycPrefill(open: boolean, ztoAccepted: boolean): ZtoKycPrefill {
  const [prefill, setPrefill] = useState<ZtoKycPrefill>({ pan: null, bank: null, address: null });
  const requestedRef = useRef(false);

  useEffect(() => {
    if (open) return;
    const timeoutId = window.setTimeout(() => {
      requestedRef.current = false;
      setPrefill({ pan: null, bank: null, address: null });
    }, KYC_DIALOG_CLOSE_RESET_MS);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!open || !ztoAccepted || requestedRef.current) return;
    requestedRef.current = true;
    void fetchZtoReviewData()
      .then((data) => ({
        pan: mapApprovedZtoToPanPrefill(data.approved),
        bank: mapApprovedZtoToBankPrefill(data.approved),
        address: mapApprovedZtoToAddressPrefill(data.approved),
      }))
      .then(setPrefill)
      .catch(() => setPrefill({ pan: null, bank: null, address: null }));
  }, [open, ztoAccepted]);

  return prefill;
}
