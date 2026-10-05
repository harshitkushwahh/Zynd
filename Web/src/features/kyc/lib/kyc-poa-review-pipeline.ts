import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";
import { fetchPoaKycFormStatus, startPoaKycForm, syncPoaKycForm } from "@/features/kyc/lib/kyc-api";
import { shouldUsePoaPartnerForm } from "@/features/kyc/lib/kyc-flow-mode";
import { ApiError } from "@/lib/api-client";

export type PoaReviewGateResult =
  | { kind: "ok" }
  | { kind: "blocked"; message: string };

/**
 * Review submit: sync demographic data to the POA kyc_form only (one partner round-trip when possible).
 * Identity proof is Finprim DigiLocker on the address step — never a second redirect here.
 */
export async function ensurePoaPartnerProofReadyForSubmit(
  bootstrap?: Pick<KycBootstrapResponse, "kyc_flow_mode"> | null,
): Promise<PoaReviewGateResult> {
  if (!shouldUsePoaPartnerForm(bootstrap)) {
    return { kind: "ok" };
  }
  try {
    const status = await fetchPoaKycFormStatus();
    if (!status.form_id) {
      await startPoaKycForm();
    }
    await syncPoaKycForm();
    return { kind: "ok" };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Could not prepare KYC submission with the partner.";
    return { kind: "blocked", message };
  }
}
