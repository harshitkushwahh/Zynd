import type { AddInvestorAddressFields } from "@/lib/add-investor/add-investor-journey";
import { emptyAddressFields } from "@/lib/add-investor/add-investor-journey";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function normalizePanInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function normalizeMobileInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function normalizeIfscInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
}

export const DIGILOCKER_PREFILL_ADDRESS: AddInvestorAddressFields = emptyAddressFields();

export type DemoPanVerificationResult =
  | { ok: true; displayName: string; kycAlreadyRegistered: boolean }
  | { ok: false; error: string };

export async function verifyDemoPan(_pan: string): Promise<DemoPanVerificationResult> {
  return { ok: false, error: "PAN verification is not connected yet." };
}

export type DemoBankDetailsRequest = {
  ifsc: string;
  accountNumber: string;
  accountType: string;
  accountHolderName: string;
};

export type DemoBankDetailsResult =
  | {
      ok: true;
      accountHolderName: string;
      bankName: string;
      branchName: string;
    }
  | { ok: false; error: string };

export async function fetchDemoBankDetails(
  _request: DemoBankDetailsRequest,
): Promise<DemoBankDetailsResult> {
  return { ok: false, error: "Bank verification is not connected yet." };
}
