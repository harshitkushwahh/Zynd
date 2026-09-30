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
  fpPaymentStatus?: string | null;
  paymentCompleted?: boolean;
  orderType?: string | null;
};

export function mfOrderStatusVariant(
  status: string,
  fpState?: string | null,
  paymentCompleted?: boolean,
  fpPaymentStatus?: string | null,
  orderType?: string | null,
): StatusBadgeVariant {
  return mfOrderStatusVariantForInvestor(status, {
    fp_state: fpState ?? null,
    fp_payment_status: fpPaymentStatus ?? null,
    status,
    payment_completed: paymentCompleted,
    order_type: orderType ?? undefined,
  });
}

export function mfOrderRowHoverClass(
  status: string,
  fpState?: string | null,
  paymentCompleted?: boolean,
  orderType?: string | null,
) {
  const variant = mfOrderStatusVariant(status, fpState, paymentCompleted, undefined, orderType);
  if (variant === "destructive") return "hover:bg-destructive/[0.08]";
  if (variant === "success") return "hover:bg-success/[0.08]";
  if (variant === "warning") return "hover:bg-warning/[0.08]";
  return "hover:bg-muted/40";
}

export function mfOrderRowAvatarClass(
  status: string,
  fpState?: string | null,
  paymentCompleted?: boolean,
  orderType?: string | null,
) {
  const variant = mfOrderStatusVariant(status, fpState, paymentCompleted, undefined, orderType);
  if (variant === "destructive") return "bg-destructive/5 ring-destructive/15";
  if (variant === "success") return "bg-success/5 ring-success/20";
  if (variant === "warning") return "bg-warning/5 ring-warning/20";
  return "bg-card ring-border/60";
}

export function MfOrderStatusBadge({
  status,
  className,
  fpState,
  fpPaymentStatus,
  paymentCompleted,
  orderType,
}: MfOrderStatusBadgeProps) {
  const order = {
    fp_state: fpState ?? null,
    fp_payment_status: fpPaymentStatus ?? null,
    status,
    payment_completed: paymentCompleted,
    order_type: orderType ?? "",
  };

  return (
    <StatusBadge
      variant={mfOrderStatusVariantForInvestor(status, order)}
      className={cn("normal-case", className)}
    >
      {formatMfOrderStatusLabel(status, order)}
    </StatusBadge>
  );
}
