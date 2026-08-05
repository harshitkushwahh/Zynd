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

function mapApiStepStatus(status: string): AdminKycFlowStepStatus {
  if (status === "skipped") return "not_applicable";
  if (status === "verified" || status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "pending";
}

export function buildAdminKycFlowSteps(kyc: AdminUserKycDetail): AdminKycFlowStep[] {
  const steps = ADMIN_KYC_FLOW_STEP_IDS.map((id) => ({
    id,
    label: STEP_LABELS[id] ?? id,
    status: mapApiStepStatus(kyc.step_statuses[id] ?? "pending"),
    applicable: true,
  }));

  return applyKycStepApplicability(steps, kyc.kyc_already_registered ?? false);
}

/** KRA-compliant investors skip DigiLocker, signature, and eSign. */
export function applyKycStepApplicability(
  steps: AdminKycFlowStep[],
  kycAlreadyRegistered: boolean,
): AdminKycFlowStep[] {
  return steps.map((step) => {
    const skipForCompliant =
      kycAlreadyRegistered &&
      (step.id === "digilocker" || step.id === "signature" || step.id === "esign");
    if (skipForCompliant) {
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
