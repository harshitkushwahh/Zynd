import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";
import { fetchPoaKycFormStatus, startPoaKycForm, syncPoaKycForm } from "@/features/kyc/lib/kyc-api";
import { shouldUsePoaPartnerForm } from "@/features/kyc/lib/kyc-flow-mode";
import { ApiError } from "@/lib/api-client";

export type PoaReviewGateResult =
  | { kind: "ok" }
  | { kind: "blocked"; message: string }
  | { kind: "proof_redirect"; fetchUrl: string };

/**
 * Review submit: ensure POA kyc_form exists, sync demographics, and surface pending proof DigiLocker.
 */
export async function ensurePoaPartnerProofReadyForSubmit(
  bootstrap?: Pick<KycBootstrapResponse, "kyc_flow_mode"> | null,
): Promise<PoaReviewGateResult> {
  if (!shouldUsePoaPartnerForm(bootstrap)) {
    return { kind: "ok" };
  }
  try {
    let status = await fetchPoaKycFormStatus();
    if (!status.form_id) {
      status = await startPoaKycForm();
    }
    const fetchUrl = status.proof_fetch_url?.trim() ?? "";
    if (status.needs_digilocker && fetchUrl) {
      return { kind: "proof_redirect", fetchUrl };
    }
    await syncPoaKycForm();
    status = await fetchPoaKycFormStatus();
    const afterSyncUrl = status.proof_fetch_url?.trim() ?? "";
    if (status.needs_digilocker && afterSyncUrl) {
      return { kind: "proof_redirect", fetchUrl: afterSyncUrl };
    }
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
