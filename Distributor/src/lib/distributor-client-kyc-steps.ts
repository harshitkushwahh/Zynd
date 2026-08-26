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

import { DISTRIBUTOR_KYC_STEPS, kycProgressPct } from "@/lib/distributor-client-copy";
import type { DistributorClientKycStep, DistributorKycStepStatus } from "@/lib/distributor-types";

type BuildDistributorKycStepsInput = {
  stepStatuses?: Record<string, string> | null;
  incompleteSteps?: Array<{ key: string; status?: string }> | null;
  kycCompliant: boolean;
  kycAlreadyRegistered?: boolean;
};

function mapApiKycStepStatus(
  statusRaw: string,
  kycCompliant: boolean,
): DistributorKycStepStatus {
  if (statusRaw === "failed") return "failed";
  if (statusRaw === "skipped") return "not_applicable";
  if (statusRaw === "verified" || statusRaw === "completed") return "completed";
  // Fully registered investors may have legacy pending flags on otherwise complete steps.
  if (kycCompliant) return "completed";
  // Draft-only progress (saved) and untouched steps stay open in the console.
  return "pending";
}

export function buildDistributorKycSteps({
  stepStatuses,
  incompleteSteps,
  kycCompliant,
  kycAlreadyRegistered = false,
}: BuildDistributorKycStepsInput): DistributorClientKycStep[] {
  const statuses = stepStatuses ?? {};
  const incomplete = new Map(
    (incompleteSteps ?? []).map((step) => [step.key, step.status ?? "pending"]),
  );

  const steps = DISTRIBUTOR_KYC_STEPS.map(({ id, label }) => {
    const statusRaw = statuses[id] ?? incomplete.get(id) ?? "pending";
    return {
      id,
      label,
      status: mapApiKycStepStatus(statusRaw, kycCompliant),
    };
  });

  return applyKycStepApplicability(steps, kycCompliant, kycAlreadyRegistered);
}

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

/** KRA path investors skip DigiLocker, signature, and eSign. */
export function applyKycStepApplicability(
  steps: DistributorClientKycStep[],
  kycCompliant: boolean,
  kycAlreadyRegistered = false,
): DistributorClientKycStep[] {
  const kraPath = kycCompliant || kycAlreadyRegistered;

  return steps.map((step) => {
    const skipForKraPath =
      kraPath &&
      (step.id === "digilocker" || step.id === "signature" || step.id === "esign");
    if (skipForKraPath) {
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

/** True when every applicable step is completed. */
export function isKycJourneyComplete(steps: DistributorClientKycStep[]): boolean {
  const applicable = kycApplicableSteps(steps);
  return applicable.length > 0 && applicable.every((step) => step.status === "completed");
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
