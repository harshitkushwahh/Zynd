import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  FileSignature,
  ClipboardCheck,
  Home,
  IdCard,
  Landmark,
  PenLine,
  UserRound,
  Users,
} from "lucide-react";

import { kycProgressPct } from "@/lib/distributor-client-copy";
import type { DistributorClientKycStep } from "@/lib/dummy/types";

export type DistributorKycStepGroup = {
  id: string;
  label: string;
  description: string;
  stepIds: string[];
};

export const DISTRIBUTOR_KYC_STEP_GROUPS: DistributorKycStepGroup[] = [
  {
    id: "identity",
    label: "Identity",
    description: "PAN and Aadhaar verification path",
    stepIds: ["pan", "digilocker"],
  },
  {
    id: "profile",
    label: "Profile & banking",
    description: "Address, personal details, nominee, and bank",
    stepIds: ["address", "personal", "nominee", "bank"],
  },
  {
    id: "signoff",
    label: "Sign-off",
    description: "Signature, eSign, and final review",
    stepIds: ["signature", "esign", "review"],
  },
];

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

export function kycStepIcon(stepId: string): LucideIcon {
  return STEP_ICONS[stepId] ?? ClipboardCheck;
}

/** KRA-compliant investors skip DigiLocker, signature, and eSign. */
export function applyKycStepApplicability(
  steps: DistributorClientKycStep[],
  kycCompliant: boolean,
): DistributorClientKycStep[] {
  return steps.map((step) => {
    const skipForCompliant =
      kycCompliant &&
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

export function kycApplicableSteps(steps: DistributorClientKycStep[]): DistributorClientKycStep[] {
  return steps.filter((step) => step.applicable !== false);
}

export function summarizeKycProgress(steps: DistributorClientKycStep[]) {
  const applicable = kycApplicableSteps(steps);
  const completed = applicable.filter((step) => step.status === "completed").length;
  const total = applicable.length;
  return {
    applicable,
    completed,
    total,
    percent: kycProgressPct(completed, total),
  };
}

export function groupKycSteps(steps: DistributorClientKycStep[]): Array<{
  group: DistributorKycStepGroup;
  steps: DistributorClientKycStep[];
}> {
  const byId = new Map(steps.map((step) => [step.id, step]));
  return DISTRIBUTOR_KYC_STEP_GROUPS.map((group) => ({
    group,
    steps: group.stepIds.map((id) => byId.get(id)).filter(Boolean) as DistributorClientKycStep[],
  })).filter((entry) => entry.steps.length > 0);
}

/** Latest step in the journey: failed or pending if any, otherwise the final applicable step. */
export function resolveKycLastActiveStep(
  steps: DistributorClientKycStep[],
): DistributorClientKycStep | null {
  const applicable = kycApplicableSteps(steps);
  if (applicable.length === 0) return null;

  const failed = applicable.find((step) => step.status === "failed");
  if (failed) return failed;

  const pending = applicable.find((step) => step.status === "pending");
  if (pending) return pending;

  return applicable[applicable.length - 1] ?? null;
}
