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
  if (normalized === "CANCELLED") return "neutral";
  if (normalized === "PENDING" || normalized === "REVIEW" || normalized === "CONSENT_PENDING") {
    return "warning";
  }
  return "neutral";
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
        : normalized === "CANCELLED"
          ? "neutral"
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
