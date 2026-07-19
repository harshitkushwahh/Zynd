import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

function formatStatusLabel(value: string) {
  return value
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function mfTransactionStatusVariant(status: string): StatusBadgeVariant {
  const normalized = status.trim().toUpperCase();
  if (normalized === "SUCCEEDED" || normalized === "ACTIVE" || normalized === "COMPLETED") {
    return "success";
  }
  if (normalized === "FAILED" || normalized === "CANCELLED" || normalized === "REJECTED") {
    return "destructive";
  }
  if (
    normalized === "PENDING" ||
    normalized === "PROCESSING" ||
    normalized === "PAYMENT_PENDING" ||
    normalized === "CONSENT_PENDING" ||
    normalized === "REVIEW"
  ) {
    return "warning";
  }
  if (normalized === "SUBMITTED") {
    return "info";
  }
  return "neutral";
}

export function mfGatewayStateVariant(fpState: string): StatusBadgeVariant {
  const normalized = fpState.trim().toLowerCase();
  if (normalized === "successful" || normalized === "succeeded" || normalized === "completed" || normalized === "active") {
    return "success";
  }
  if (
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "rejected" ||
    normalized === "expired" ||
    normalized === "reversed"
  ) {
    return "destructive";
  }
  if (
    normalized === "under_review" ||
    normalized === "review_completed" ||
    normalized === "confirmed" ||
    normalized === "submitted_to_amc"
  ) {
    return "info";
  }
  if (
    normalized === "pending" ||
    normalized === "payment_pending" ||
    normalized === "awaiting_payment" ||
    normalized === "payment_confirmed" ||
    normalized === "units_allocated" ||
    normalized === "pending_authorization"
  ) {
    return "warning";
  }
  if (normalized === "submitted" || normalized === "created") {
    return "info";
  }
  return "neutral";
}

function shouldShowGatewayState(status: string, fpState: string | null | undefined) {
  if (!fpState?.trim()) return false;
  const normalizedStatus = status.trim().toUpperCase().replaceAll(" ", "_");
  const normalizedFpState = fpState.trim().toLowerCase();
  if (normalizedFpState === normalizedStatus.toLowerCase()) return false;
  if (normalizedFpState === normalizedStatus.replaceAll("_", " ").toLowerCase().replaceAll(" ", "_")) {
    return false;
  }
  return true;
}

type MfPaymentStatusBadgesProps = {
  status: string;
  fpState?: string | null;
  className?: string;
};

export function MfPaymentStatusBadges({ status, fpState, className }: MfPaymentStatusBadgesProps) {
  const showGatewayState = shouldShowGatewayState(status, fpState);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <StatusBadge variant={mfTransactionStatusVariant(status)} className="h-6 px-2.5 text-[11px] normal-case">
        {formatStatusLabel(status)}
      </StatusBadge>
      {showGatewayState && fpState ? (
        <StatusBadge variant={mfGatewayStateVariant(fpState)} className="h-6 px-2.5 text-[11px] normal-case">
          {formatStatusLabel(fpState)}
        </StatusBadge>
      ) : null}
    </div>
  );
}
