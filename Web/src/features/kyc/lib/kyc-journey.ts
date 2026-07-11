import { copy } from "@/shared/config/copy";

export type KycJourneyStepId =
  | "pan-card"
  | "address"
  | "personal-info"
  | "nominee"
  | "bank"
  | "signature"
  | "review";

export type KycJourneyStep = {
  id: KycJourneyStepId;
  label: string;
};

export const KYC_JOURNEY_STEPS: KycJourneyStep[] = [
  { id: "pan-card", label: copy.kyc.steps.panCard },
  { id: "address", label: copy.kyc.steps.address },
  { id: "personal-info", label: copy.kyc.steps.personalInfo },
  { id: "nominee", label: copy.kyc.steps.nominee },
  { id: "bank", label: copy.kyc.steps.bank },
  { id: "signature", label: copy.kyc.steps.signature },
  { id: "review", label: copy.kyc.steps.review },
];

const REKYC_READINESS_CODES = new Set([
  "kyc_incomplete",
  "kyc_legacy",
  "kyc_onhold",
  "kyc_rejected",
]);

export function requiresFullKycSubmission(input: {
  kyc_already_registered?: boolean | null;
  readiness_code?: string | null;
}): boolean {
  if (!input.kyc_already_registered) return true;
  const code = (input.readiness_code ?? "").toLowerCase();
  return REKYC_READINESS_CODES.has(code);
}

export function getKycJourneySteps(requiresFullKyc: boolean): KycJourneyStep[] {
  if (requiresFullKyc) return KYC_JOURNEY_STEPS;
  return KYC_JOURNEY_STEPS.filter((step) => step.id !== "signature");
}

export function getKycJourneyStep(steps: KycJourneyStep[], index: number): KycJourneyStep | undefined {
  return steps[index];
}
