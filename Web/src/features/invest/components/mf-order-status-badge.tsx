import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";

function formatStatusLabel(value: string) {
  return value
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function mfOrderStatusVariant(status: string): StatusBadgeVariant {
  const normalized = status.trim().toUpperCase();
  if (normalized === "SUCCEEDED") return "success";
  if (normalized === "FAILED" || normalized === "CANCELLED") return "destructive";
  if (
    normalized === "PENDING" ||
    normalized === "PROCESSING" ||
    normalized === "PAYMENT_PENDING" ||
    normalized === "SUBMITTED"
  ) {
    return "warning";
  }
  return "neutral";
}

export function MfOrderStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge variant={mfOrderStatusVariant(status)} className="normal-case">
      {formatStatusLabel(status)}
    </StatusBadge>
  );
}
