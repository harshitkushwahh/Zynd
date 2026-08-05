import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";

function formatStatusLabel(value: string) {
  return value
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function mfSipPlanStatusVariant(status: string): StatusBadgeVariant {
  const normalized = status.trim().toUpperCase();
  if (normalized === "ACTIVE") return "success";
  if (normalized === "FAILED" || normalized === "CANCELLED") return "destructive";
  if (
    normalized === "PENDING" ||
    normalized === "REVIEW" ||
    normalized === "CONSENT_PENDING"
  ) {
    return "warning";
  }
  return "neutral";
}

export function MfSipPlanStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge variant={mfSipPlanStatusVariant(status)} className="normal-case">
      {formatStatusLabel(status)}
    </StatusBadge>
  );
}
