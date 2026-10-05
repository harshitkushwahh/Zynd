import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";
import { requiresFullKycSubmission } from "@/features/kyc/lib/kyc-journey";
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
  poaReadinessPreverifyId?: string | null,
): boolean {
  return requiresFullKycSubmission({
    kyc_already_registered: kycAlreadyRegistered,
    readiness_code: readinessCode,
    poa_readiness_preverify_id: poaReadinessPreverifyId,
  });
}

export function isDigilockerComplete(
  input:
    | {
        external_kyc_status?: string | null;
        external_identity_document_id?: string | null;
        contact_draft?: Record<string, unknown> | null;
      }
    | null
    | undefined,
): boolean {
  if (!input) return false;
  if (input.external_kyc_status === "returned_failed") return false;
  if (!input.external_identity_document_id?.trim()) return false;
  return input.external_kyc_status === "returned_success";
}

export function shouldBlockAddressStep(input: {
  kyc_already_registered?: boolean | null;
  readiness_code?: string | null;
  external_kyc_status?: string | null;
  external_identity_document_id?: string | null;
  contact_draft?: Record<string, unknown> | null;
  poa_readiness_preverify_id?: string | null;
  requires_address_step_digilocker?: boolean | null;
  requires_digilocker?: boolean | null;
} | null | undefined): boolean {
  if (!input) return false;
  const digilockerRequired =
    input.requires_address_step_digilocker != null
      ? Boolean(input.requires_address_step_digilocker)
      : input.requires_digilocker != null
        ? Boolean(input.requires_digilocker)
        : isDigilockerRequired(
            input.kyc_already_registered,
            input.readiness_code,
            input.poa_readiness_preverify_id,
          );
  return digilockerRequired && !isDigilockerComplete(input);
}

export function capReachableStepIndex(
  serverIndex: number,
  steps: Array<{ id: string }>,
  input: {
    kyc_already_registered?: boolean | null;
    readiness_code?: string | null;
    external_kyc_status?: string | null;
    external_identity_document_id?: string | null;
    contact_draft?: Record<string, unknown> | null;
    poa_readiness_preverify_id?: string | null;
  } | null | undefined,
): number {
  if (!shouldBlockAddressStep(input)) return serverIndex;
  const addressIndex = steps.findIndex((step) => step.id === "address");
  if (addressIndex < 0) return serverIndex;
  return Math.min(serverIndex, addressIndex);
}

const PHASE1_COMPLETE_STEPS = new Set([
  "personal",
  "nominee",
  "bank",
  "signature",
  "review",
]);

/** Review / eSign resume only when DigiLocker + phase-1 drafts are actually done. */
export function shouldFocusReviewAfterPartnerReturn(
  payload: KycBootstrapResponse,
  options: { esignReturnActive: boolean; pendingEsignResume: boolean },
): boolean {
  if (!options.esignReturnActive && !options.pendingEsignResume) return false;
  if (shouldBlockAddressStep(payload)) return false;
  const lastStep = payload.last_completed_step;
  if (!lastStep || !PHASE1_COMPLETE_STEPS.has(lastStep)) return false;
  if (!payload.contact_draft || !payload.personal_draft) return false;
  return true;
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

