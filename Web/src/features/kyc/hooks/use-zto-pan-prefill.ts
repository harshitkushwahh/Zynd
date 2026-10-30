"use client";

import type { KycPanDraft } from "@/features/kyc/lib/kyc-api";

import { useZtoKycPrefill } from "@/features/kyc/hooks/use-zto-kyc-prefill";

/** @deprecated Prefer useZtoKycPrefill for PAN + bank seeds. */
export function useZtoPanPrefill(enabled: boolean): KycPanDraft | null {
  return useZtoKycPrefill(enabled, enabled).pan;
}
