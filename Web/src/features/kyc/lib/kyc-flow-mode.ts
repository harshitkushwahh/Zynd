import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";

export type KycFlowMode = "repeat_kra" | "fresh_kyc" | "kra_update";

export function resolveKycFlowMode(
  bootstrap: Pick<KycBootstrapResponse, "kyc_flow_mode"> | null | undefined,
): KycFlowMode {
  const mode = bootstrap?.kyc_flow_mode;
  if (mode === "repeat_kra" || mode === "fresh_kyc" || mode === "kra_update") {
    return mode;
  }
  return "fresh_kyc";
}

/** Cybrilla POA kyc_forms at Review — kra_update (J3) only; fresh_kyc (J2) uses Finprim eSign. */
export function shouldUsePoaPartnerForm(
  bootstrap: Pick<KycBootstrapResponse, "kyc_flow_mode"> | null | undefined,
): boolean {
  return resolveKycFlowMode(bootstrap) === "kra_update";
}

export function requiresAddressStepDigilocker(
  bootstrap: Pick<
    KycBootstrapResponse,
    "requires_address_step_digilocker" | "requires_pan_step_digilocker" | "requires_digilocker"
  > | null | undefined,
): boolean {
  if (bootstrap?.requires_address_step_digilocker != null) {
    return Boolean(bootstrap.requires_address_step_digilocker);
  }
  if (bootstrap?.requires_pan_step_digilocker != null) {
    return Boolean(bootstrap.requires_pan_step_digilocker);
  }
  return Boolean(bootstrap?.requires_digilocker);
}

/** @deprecated Use requiresAddressStepDigilocker — Path A runs at the address step. */
export const requiresPanStepDigilockerAddress = requiresAddressStepDigilocker;
