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

export function isRekycReadinessCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const normalized = code.toLowerCase();
  return ["kyc_incomplete", "kyc_legacy", "kyc_onhold", "kyc_rejected"].includes(normalized);
}

export function isDigilockerRequired(
  kycAlreadyRegistered: boolean | null | undefined,
  readinessCode: string | null | undefined,
): boolean {
  if (kycAlreadyRegistered) return false;
  const normalized = (readinessCode ?? "").toLowerCase();
  if (normalized === "kyc_incomplete") return true;
  if (isRekycReadinessCode(readinessCode)) return false;
  return true;
}

export function isDigilockerComplete(input: {
  external_kyc_status?: string | null;
} | null | undefined): boolean {
  return input?.external_kyc_status === "returned_success";
}

export function shouldBlockAddressStep(input: {
  kyc_already_registered?: boolean | null;
  readiness_code?: string | null;
  external_kyc_status?: string | null;
} | null | undefined): boolean {
  if (!input) return false;
  return isDigilockerRequired(input.kyc_already_registered, input.readiness_code) && !isDigilockerComplete(input);
}

export function capReachableStepIndex(
  serverIndex: number,
  steps: Array<{ id: string }>,
  input: {
    kyc_already_registered?: boolean | null;
    readiness_code?: string | null;
    external_kyc_status?: string | null;
  } | null | undefined,
): number {
  if (!shouldBlockAddressStep(input)) return serverIndex;
  const addressIndex = steps.findIndex((step) => step.id === "address");
  if (addressIndex <= 0) return serverIndex;
  return Math.min(serverIndex, addressIndex - 1);
}

export function shouldShowDigilockerFailureAlert(
  payload: KycBootstrapResponse | null | undefined,
  forceShow = false,
): boolean {
  if (forceShow) return true;
  if (!payload || !shouldBlockAddressStep(payload)) return false;
  if (payload.pan_verification_status !== "verified") return false;
  if (isDigilockerComplete(payload)) return false;

  if (payload.digilocker_failure_reason) return true;

  const status = payload.external_kyc_status;
  if (status === "returned_failed" || status === "started") return true;

  return false;
}

export function digilockerFailureDescription(
  payload: KycBootstrapResponse | null | undefined,
): string | null {
  if (!payload) return null;
  return payload.digilocker_failure_reason ?? null;
}

