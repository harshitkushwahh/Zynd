import type { MfOrder } from "@/features/invest/api/invest-api";
import { isOrderPaymentCompleted } from "@/features/invest/lib/mf-order-payment-status";

export function formatCybrillaStatusLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveCybrillaOrderStatusLabel(
  order: Pick<MfOrder, "status" | "fp_state" | "fp_payment_status" | "payment_completed"> &
    Partial<Pick<MfOrder, "order_type">>,
): string {
  if (order.order_type?.trim().toUpperCase() === "REDEMPTION") {
    const redemptionLabel = formatCybrillaStatusLabel(order.fp_state);
    if (redemptionLabel) return redemptionLabel;
    return order.status
      .trim()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  if (order.fp_payment_status && !isOrderPaymentCompleted(order)) {
    const paymentLabel = formatCybrillaStatusLabel(order.fp_payment_status);
    if (paymentLabel) return paymentLabel;
  }

  const purchaseLabel = formatCybrillaStatusLabel(order.fp_state);
  if (purchaseLabel) return purchaseLabel;

  return order.status
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
