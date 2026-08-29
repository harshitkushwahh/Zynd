import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ClipboardCheck,
  FileSignature,
  Home,
  IdCard,
  Landmark,
  PenLine,
  UserRound,
  Users,
} from "lucide-react";

import type { AdminUserKycDetail } from "@/lib/admin-api";

export type AdminKycFlowStepStatus = "completed" | "pending" | "failed" | "not_applicable";

export type AdminKycFlowStep = {
  id: string;
  label: string;
  status: AdminKycFlowStepStatus;
  applicable: boolean;
};

export const ADMIN_KYC_FLOW_STEP_IDS = [
  "pan",
  "digilocker",
  "address",
  "personal",
  "nominee",
  "bank",
  "signature",
  "esign",
  "review",
] as const;

const STEP_LABELS: Record<string, string> = {
  pan: "PAN verification",
  digilocker: "DigiLocker",
  address: "Address",
  personal: "Personal details",
  nominee: "Nominee",
  bank: "Bank account",
  signature: "Signature",
  esign: "eSign",
  review: "Review & submit",
};

const STEP_ICONS: Record<string, LucideIcon> = {
  pan: IdCard,
  digilocker: BadgeCheck,
  address: Home,
  personal: UserRound,
  nominee: Users,
  bank: Landmark,
  signature: PenLine,
  esign: FileSignature,
  review: ClipboardCheck,
};

export function adminKycStepIcon(stepId: string): LucideIcon {
  return STEP_ICONS[stepId] ?? ClipboardCheck;
}

const KRA_SKIPPED_STEP_IDS = new Set(["digilocker", "signature", "esign", "nominee"]);

export function isAdminKycKraPath(kyc: Pick<AdminUserKycDetail, "kyc_already_registered">) {
  return Boolean(kyc.kyc_already_registered);
}

export function isAdminKycJourneyComplete(kyc: Pick<AdminUserKycDetail, "overall_status">) {
  return kyc.overall_status === "completed";
}

function mapApiStepStatus(status: string, journeyComplete: boolean): AdminKycFlowStepStatus {
  if (status === "skipped") return "not_applicable";
  if (status === "verified" || status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (journeyComplete) return "completed";
  return "pending";
}

export function buildAdminKycFlowSteps(kyc: AdminUserKycDetail): AdminKycFlowStep[] {
  const journeyComplete = isAdminKycJourneyComplete(kyc);
  const steps = ADMIN_KYC_FLOW_STEP_IDS.map((id) => ({
    id,
    label: STEP_LABELS[id] ?? id,
    status: mapApiStepStatus(kyc.step_statuses[id] ?? "pending", journeyComplete),
    applicable: true,
  }));

  return applyKycStepApplicability(steps, isAdminKycKraPath(kyc));
}

/** KRA-compliant investors skip DigiLocker, signature, eSign, and nominee. */
export function applyKycStepApplicability(
  steps: AdminKycFlowStep[],
  kycAlreadyRegistered: boolean,
): AdminKycFlowStep[] {
  return steps.map((step) => {
    if (kycAlreadyRegistered && KRA_SKIPPED_STEP_IDS.has(step.id)) {
      return {
        ...step,
        applicable: false,
        status: "not_applicable",
      };
    }
    return { ...step, applicable: true };
  });
}

export function kycApplicableSteps(steps: AdminKycFlowStep[]): AdminKycFlowStep[] {
  return steps.filter((step) => step.applicable !== false);
}

export function summarizeKycProgress(steps: AdminKycFlowStep[]) {
  const applicable = kycApplicableSteps(steps);
  const completed = applicable.filter((step) => step.status === "completed").length;
  const total = applicable.length;
  return {
    applicable,
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function resolveKycLastActiveStep(steps: AdminKycFlowStep[]): AdminKycFlowStep | null {
  const applicable = kycApplicableSteps(steps);
  if (applicable.length === 0) return null;

  const failed = applicable.find((step) => step.status === "failed");
  if (failed) return failed;

  const pending = applicable.find((step, index) => {
    if (step.status !== "pending") return false;
    const hasCompletedLater = applicable
      .slice(index + 1)
      .some((later) => later.status === "completed");
    return !hasCompletedLater;
  });
  if (pending) return pending;

  return applicable[applicable.length - 1] ?? null;
}
