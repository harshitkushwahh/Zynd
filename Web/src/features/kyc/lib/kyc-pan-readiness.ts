import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";
import { copy } from "@/shared/config/copy";

export type KycReadinessInfo = {
  status?: string;
  code?: string | null;
  reason?: string | null;
};

export type PanReadinessBadgeConfig = {
  label: string;
  variant: StatusBadgeVariant;
};

export function getPanReadinessBadge(
  readiness: KycReadinessInfo | null | undefined,
): PanReadinessBadgeConfig | null {
  if (!readiness?.status) return null;

  if (readiness.status === "verified") {
    return {
      label: copy.kyc.pan.kraRegisteredBadge,
      variant: "success",
    };
  }

  if (readiness.status !== "failed") return null;

  switch (readiness.code) {
    case "kyc_unavailable":
    case "kyc_rejected":
      return {
        label: copy.kyc.pan.newToKycBadge,
        variant: "warning",
      };
    case "kyc_incomplete":
    case "kyc_legacy":
      return {
        label: copy.kyc.pan.kycUpdateRequiredBadge,
        variant: "info",
      };
    case "kyc_onhold":
      return {
        label: copy.kyc.pan.kycOnHoldBadge,
        variant: "info",
      };
    case "unknown":
      return {
        label: copy.kyc.pan.kycStatusUnclearBadge,
        variant: "neutral",
      };
    case "upstream_error":
      return {
        label: copy.kyc.pan.kycCheckPendingBadge,
        variant: "neutral",
      };
    default:
      return {
        label: copy.kyc.pan.newToKycBadge,
        variant: "warning",
      };
  }
}

export function readinessFromBootstrap(payload: KycBootstrapResponse): KycReadinessInfo | null {
  if (payload.pan_verification_status !== "verified") return null;
  if (payload.kyc_already_registered == null && !payload.readiness_code) return null;

  return {
    status: payload.kyc_already_registered ? "verified" : "failed",
    code: payload.readiness_code,
    reason: payload.readiness_reason,
  };
}
