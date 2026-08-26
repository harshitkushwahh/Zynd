import type { AddInvestorReadiness } from "@/lib/add-investor/add-investor-journey";
import type { KycReadinessInfo } from "@/lib/distributor-client-onboarding-api";

export function mapPanVerifyToInvestorReadiness(input: {
  kycAlreadyRegistered?: boolean;
  readiness?: KycReadinessInfo | null;
}): AddInvestorReadiness {
  if (input.kycAlreadyRegistered) {
    return {
      code: "kra_registered",
      label: "KRA registered",
      hint: input.readiness?.reason || "Existing KYC on record.",
    };
  }

  const code = (input.readiness?.code || "kyc_unavailable").toLowerCase();
  switch (code) {
    case "kyc_incomplete":
    case "kyc_legacy":
    case "kyc_onhold":
      return {
        code,
        label: "KYC update required",
        hint: input.readiness?.reason || "Investor has an existing KRA record that needs updating.",
      };
    case "kyc_rejected":
      return {
        code,
        label: "New to KYC",
        hint: input.readiness?.reason || "Complete DigiLocker and e-sign.",
      };
    default:
      return {
        code: "new_to_kyc",
        label: "New to KYC",
        hint: input.readiness?.reason || "Complete DigiLocker and e-sign.",
      };
  }
}
