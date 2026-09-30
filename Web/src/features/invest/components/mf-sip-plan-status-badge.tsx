import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import type { MfSipPlan } from "@/features/invest/api/invest-api";
import { resolveSipPlanDisplayStatus } from "@/features/invest/lib/mf-sip-display-status";

function mapDisplayTone(tone: ReturnType<typeof resolveSipPlanDisplayStatus>["tone"]): StatusBadgeVariant {
  if (tone === "success") return "success";
  if (tone === "destructive") return "destructive";
  if (tone === "warning") return "warning";
  return "neutral";
}

export function mfSipPlanStatusVariantFromStatus(status: string): StatusBadgeVariant {
  const normalized = status.trim().toUpperCase();
  if (normalized === "ACTIVE") return "success";
  if (normalized === "FAILED") return "destructive";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "destructive";
  if (normalized === "PENDING" || normalized === "REVIEW" || normalized === "CONSENT_PENDING") {
    return "warning";
  }
  return "neutral";
}

export function mfSipPlanStatusVariantFromProviderState(
  fpState: string | null | undefined,
): StatusBadgeVariant {
  const normalized = fpState?.trim().toLowerCase() ?? "";
  if (!normalized) return "neutral";
  if (normalized === "active" || normalized === "confirmed") return "success";
  if (["failed", "cancelled", "canceled", "rejected", "expired"].includes(normalized)) {
    return "destructive";
  }
  if (["created", "under_review", "review", "review_completed", "submitted"].includes(normalized)) {
    return "info";
  }
  return "neutral";
}

export function mfSipPlanJourneyStepVariant(step: {
  event: { payload?: Record<string, unknown> | null; to_status?: string | null };
  isSuccess?: boolean;
  isTerminal?: boolean;
}): StatusBadgeVariant {
  if (step.isSuccess) return "success";
  if (step.isTerminal) return "destructive";
  const fpState = typeof step.event.payload?.fp_state === "string" ? step.event.payload.fp_state : null;
  if (fpState) return mfSipPlanStatusVariantFromProviderState(fpState);
  return mfSipPlanStatusVariantFromStatus(step.event.to_status ?? "");
}

export function mfSipPlanStatusVariant(plan: Pick<MfSipPlan, "status" | "next_action" | "bank_switch">): StatusBadgeVariant {
  return mapDisplayTone(resolveSipPlanDisplayStatus(plan as MfSipPlan).tone);
}

export function MfSipPlanStatusBadge({ plan }: { plan: MfSipPlan }) {
  const display = resolveSipPlanDisplayStatus(plan);
  return (
    <StatusBadge variant={mapDisplayTone(display.tone)} className="normal-case">
      {display.label}
    </StatusBadge>
  );
}

/** @deprecated Prefer MfSipPlanStatusBadge with full plan for richer labels. */
export function MfSipPlanStatusBadgeLegacy({ status }: { status: string }) {
  const normalized = status.trim().toUpperCase();
  const variant =
    normalized === "ACTIVE"
      ? "success"
      : normalized === "FAILED"
        ? "destructive"
        : normalized === "CANCELLED" || normalized === "CANCELED"
          ? "destructive"
        : normalized === "PENDING" || normalized === "REVIEW" || normalized === "CONSENT_PENDING"
          ? "warning"
          : "neutral";

  return (
    <StatusBadge variant={variant} className="normal-case">
      {status
        .trim()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())}
    </StatusBadge>
  );
}
