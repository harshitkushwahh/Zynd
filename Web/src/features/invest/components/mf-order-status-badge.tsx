import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import {
  formatMfOrderStatusLabel,
  mfOrderStatusVariantForInvestor,
} from "@/features/invest/lib/mf-order-journey-copy";
import { cn } from "@/lib/utils";

type MfOrderStatusBadgeProps = {
  status: string;
  className?: string;
  fpState?: string | null;
};

export function mfOrderStatusVariant(
  status: string,
  fpState?: string | null,
): StatusBadgeVariant {
  return mfOrderStatusVariantForInvestor(status, { fp_state: fpState ?? null });
}

export function mfOrderRowHoverClass(status: string, fpState?: string | null) {
  const variant = mfOrderStatusVariantForInvestor(status, { fp_state: fpState ?? null });
  if (variant === "destructive") return "hover:bg-destructive/[0.08]";
  if (variant === "success") return "hover:bg-success/[0.08]";
  if (variant === "warning") return "hover:bg-warning/[0.08]";
  return "hover:bg-muted/40";
}

export function mfOrderRowAvatarClass(status: string, fpState?: string | null) {
  const variant = mfOrderStatusVariantForInvestor(status, { fp_state: fpState ?? null });
  if (variant === "destructive") return "bg-destructive/5 ring-destructive/15";
  if (variant === "success") return "bg-success/5 ring-success/20";
  if (variant === "warning") return "bg-warning/5 ring-warning/20";
  return "bg-card ring-border/60";
}

export function MfOrderStatusBadge({ status, className, fpState }: MfOrderStatusBadgeProps) {
  return (
    <StatusBadge
      variant={mfOrderStatusVariantForInvestor(status, { fp_state: fpState ?? null })}
      className={cn("normal-case", className)}
    >
      {formatMfOrderStatusLabel(status, { fp_state: fpState ?? null })}
    </StatusBadge>
  );
}
