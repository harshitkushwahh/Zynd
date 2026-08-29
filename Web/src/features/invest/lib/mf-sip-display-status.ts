import type { MfSipPlan } from "@/features/invest/api/invest-api";
import { copy } from "@/shared/config/copy";

export type SipPlanDisplayStatus = {
  label: string;
  tone: "success" | "warning" | "destructive" | "neutral";
};

export function resolveSipPlanDisplayStatus(plan: MfSipPlan): SipPlanDisplayStatus {
  const status = (plan.status ?? "").trim().toUpperCase();
  const nextAction = plan.next_action ?? "";

  if (status === "ACTIVE") {
    return { label: copy.mySips.statusLabelActive, tone: "success" };
  }
  if (status === "FAILED") {
    return { label: copy.mySips.statusLabelFailed, tone: "destructive" };
  }
  if (status === "CANCELLED") {
    return { label: copy.mySips.statusLabelCancelled, tone: "neutral" };
  }
  if (
    nextAction === "authorize_mandate_switch" ||
    nextAction === "wait_bank_switch" ||
    plan.bank_switch?.in_progress
  ) {
    return { label: copy.mySips.statusLabelBankSwitch, tone: "warning" };
  }
  if (nextAction === "authorize_mandate" || nextAction === "wait_mandate") {
    return { label: copy.mySips.statusLabelPendingMandate, tone: "warning" };
  }
  if (status === "REVIEW" || status === "CONSENT_PENDING" || nextAction === "wait_review") {
    return { label: copy.mySips.statusLabelPendingReview, tone: "warning" };
  }
  if (status === "PENDING" || nextAction === "wait_processing") {
    return { label: copy.mySips.statusLabelActivating, tone: "warning" };
  }
  return { label: copy.mySips.statusLabelActivating, tone: "neutral" };
}
