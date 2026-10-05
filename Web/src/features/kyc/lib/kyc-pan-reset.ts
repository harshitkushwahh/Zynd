import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";
import type { KycJourneyDraft } from "@/features/kyc/lib/kyc-journey-draft";

export function kycJourneyHasProgressBeyondPan(
  bootstrap: KycBootstrapResponse | null,
  journeyDraft: KycJourneyDraft,
): boolean {
  if (bootstrap?.last_completed_step) {
    return true;
  }
  if (bootstrap?.contact_draft || journeyDraft.address) {
    return true;
  }
  if (bootstrap?.personal_draft || journeyDraft.personalInfo) {
    return true;
  }
  if ((bootstrap?.nominee_draft?.length ?? 0) > 0 || (journeyDraft.nominees?.length ?? 0) > 0) {
    return true;
  }
  if (bootstrap?.nomination_opted_out || journeyDraft.nominationOptedOut) {
    return true;
  }
  if (bootstrap?.bank_draft || journeyDraft.bank) {
    return true;
  }
  if (bootstrap?.bank_verification_status === "verified") {
    return true;
  }
  if (bootstrap?.signature_draft || journeyDraft.signature) {
    return true;
  }
  if (bootstrap?.external_kyc_status === "returned_success") {
    return true;
  }
  return false;
}

export type KycPanResetOptions = {
  /** Highest step index the user can open in the journey stepper (0 = PAN). */
  maxReachableStepIndex?: number;
  panStepIndex?: number;
};

export function kycPanOnFile(
  bootstrap: KycBootstrapResponse | null,
  journeyDraft: KycJourneyDraft,
): boolean {
  if (bootstrap?.pan_verification_status === "verified") {
    return true;
  }
  const draft = journeyDraft.pan ?? bootstrap?.pan_draft ?? null;
  return Boolean(
    (draft?.panNumber || draft?.panMasked) && draft?.firstName?.trim(),
  );
}

export function kycPanResetRequiresConfirm(
  bootstrap: KycBootstrapResponse | null,
  journeyDraft: KycJourneyDraft,
  options?: KycPanResetOptions,
): boolean {
  if (!kycPanOnFile(bootstrap, journeyDraft)) {
    return false;
  }

  const navigatedBeyondPan =
    options?.panStepIndex !== undefined &&
    options?.maxReachableStepIndex !== undefined &&
    options.maxReachableStepIndex > options.panStepIndex;

  return navigatedBeyondPan || kycJourneyHasProgressBeyondPan(bootstrap, journeyDraft);
}
