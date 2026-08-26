import type { MfSipPlan } from "@/features/invest/api/invest-api";
import { copy } from "@/shared/config/copy";

export function resolveSipFailureReason(plan: MfSipPlan | null | undefined): string | null {
  if (!plan) return null;

  if (mandateApprovedButPlanFailed(plan)) {
    if (plan.failure_code === "scheme_not_available" || plan.failure_code === "sip_not_allowed") {
      return copy.mutualFunds.sipMandateApprovedSchemeFailedMessage;
    }
    return copy.mutualFunds.sipMandateApprovedPlanFailedMessage;
  }

  const reason = plan.failure_reason?.trim();
  if (plan.failure_code === "scheme_not_available" && reason) return reason;
  if (plan.failure_code === "sip_not_allowed" && reason) return reason;
  if (plan.failure_code === "mandate_abandoned" && reason) return reason;

  const lowered = (reason ?? "").toLowerCase();
  if (lowered.includes("scheme") && lowered.includes("not available")) {
    return copy.mutualFunds.sipSchemeNotAvailableMessage;
  }
  if (lowered.includes("user_ip") && lowered.includes("invalid ip")) {
    return copy.mutualFunds.sipJourneyFailedMessage;
  }
  if (reason && !reason.includes("user_ip:")) return reason;

  return plan.status?.toUpperCase() === "FAILED" ? copy.mutualFunds.sipJourneyFailedMessage : null;
}

export function resolveSipJourneyErrorDescription(
  error: string | null | undefined,
  plan?: MfSipPlan | null,
): string | null {
  if (!error?.trim()) return resolveSipFailureReason(plan);

  const lowered = error.toLowerCase();
  if (lowered.includes("scheme") && lowered.includes("not available")) {
    return copy.mutualFunds.sipSchemeNotAvailableMessage;
  }
  if (lowered.includes("user_ip") && lowered.includes("invalid ip")) {
    return copy.mutualFunds.sipJourneyFailedMessage;
  }

  const fromPlan = resolveSipFailureReason(plan);
  if (fromPlan) return fromPlan;

  return error.includes("user_ip:") ? copy.mutualFunds.sipJourneyFailedMessage : error;
}

export function mandateApprovedButPlanFailed(plan: MfSipPlan | null | undefined): boolean {
  if (!plan || plan.status?.toUpperCase() !== "FAILED") return false;
  return plan.mandate?.status?.toUpperCase() === "APPROVED";
}
