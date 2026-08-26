import type { AddInvestorStepId } from "@/lib/add-investor/add-investor-journey";
import {
  emptyComplianceSnapshot,
  type AddInvestorComplianceSnapshot,
} from "@/lib/add-investor/add-investor-kyc-bootstrap";

const COMPLIANCE_DRAFT_STORAGE_KEY = "zynd.distributor.add-investor.compliance-draft";

export type AddInvestorComplianceDraft = {
  clientUserId: string;
  clientId: string;
  email: string;
  mobile: string;
  investorName: string;
  stepId: AddInvestorStepId;
  pan: string;
  updatedAt: string;
  snapshot: AddInvestorComplianceSnapshot;
};

export function readStoredAddInvestorComplianceDraft(): AddInvestorComplianceDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(COMPLIANCE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AddInvestorComplianceDraft>;
    if (!parsed?.clientUserId || !parsed?.stepId) return null;
    return {
      clientUserId: parsed.clientUserId,
      clientId: parsed.clientId ?? "",
      email: parsed.email ?? "",
      mobile: parsed.mobile ?? "",
      investorName: parsed.investorName ?? "",
      stepId: parsed.stepId as AddInvestorStepId,
      pan: parsed.pan ?? "",
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      snapshot: parsed.snapshot ?? emptyComplianceSnapshot(),
    };
  } catch {
    return null;
  }
}

export function writeStoredAddInvestorComplianceDraft(draft: AddInvestorComplianceDraft | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!draft) {
      window.sessionStorage.removeItem(COMPLIANCE_DRAFT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(COMPLIANCE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures.
  }
}

export function clearStoredAddInvestorComplianceDraft(): void {
  writeStoredAddInvestorComplianceDraft(null);
}
