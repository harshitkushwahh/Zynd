import {
  addDistributorStepIndex,
  type AddDistributorStepId,
} from "@/lib/add-distributor/add-distributor-journey";
import type { PartnerOnboardingDraftSnapshot } from "@/lib/distributor-partners-api";

export function resolvePartnerOnboardingResumeStep(
  draft: PartnerOnboardingDraftSnapshot,
): AddDistributorStepId {
  if (!draft.email_verified) return "email";
  if (!draft.mobile_verified) return "mobile";
  if (!draft.pan_verified) return "pan";
  if (!draft.first_name?.trim() || !draft.last_name?.trim()) return "name";
  if (!draft.bank_verified) return "bank";
  const address = draft.address;
  if (
    !address?.line1?.trim() ||
    !address.city?.trim() ||
    !address.state?.trim() ||
    String(address.pincode ?? "").length !== 6
  ) {
    return "address";
  }
  if (!draft.documents.pan_uploaded || !draft.documents.aadhaar_uploaded) {
    return "documents";
  }
  if (!draft.profile_photo.uploaded) return "photo";
  return "review";
}

export function partnerOnboardingResumeStepIndex(draft: PartnerOnboardingDraftSnapshot): number {
  const stepId = resolvePartnerOnboardingResumeStep(draft);
  const index = addDistributorStepIndex(stepId);
  return index >= 0 ? index : 0;
}