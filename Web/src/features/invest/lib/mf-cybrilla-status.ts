import type { MfOrder } from "@/features/invest/api/invest-api";
import { isOrderPaymentCompleted } from "@/features/invest/lib/mf-order-payment-status";
import { copy } from "@/shared/config/copy";

export function formatCybrillaStatusLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatZyndOrderStatusLabel(status: string): string {
  return formatCybrillaStatusLabel(status) ?? status.trim();
}

/** Purchase orders: gateway payment status wins until payment is completed. */
function resolvePurchaseOrderStatusLabel(
  order: Pick<MfOrder, "status" | "fp_state" | "fp_payment_status" | "payment_completed">,
): string {
  const paymentComplete = isOrderPaymentCompleted(order);
  const normalizedStatus = order.status.trim().toUpperCase();
  const fpState = order.fp_state?.trim().toLowerCase() ?? "";

  if (!paymentComplete) {
    const paymentLabel = formatCybrillaStatusLabel(order.fp_payment_status);
    if (paymentLabel) return paymentLabel;

    if (normalizedStatus === "PENDING" || normalizedStatus === "PAYMENT_PENDING") {
      return formatZyndOrderStatusLabel(order.status);
    }

    // ONDC often marks fp_state submitted before the gateway payment settles.
    if (fpState === "submitted" || normalizedStatus === "SUBMITTED") {
      return formatCybrillaStatusLabel("PENDING") ?? copy.transactions.journeyStatusAwaitingPayment;
    }

    const purchaseLabel = formatCybrillaStatusLabel(order.fp_state);
    if (purchaseLabel) return purchaseLabel;

    return formatZyndOrderStatusLabel(order.status);
  }

  const purchaseLabel = formatCybrillaStatusLabel(order.fp_state);
  if (purchaseLabel) return purchaseLabel;

  return formatZyndOrderStatusLabel(order.status);
}

export function resolveCybrillaOrderStatusLabel(
  order: Pick<MfOrder, "status" | "fp_state" | "fp_payment_status" | "payment_completed"> &
    Partial<Pick<MfOrder, "order_type">>,
): string {
  if (
    order.order_type?.trim().toUpperCase() === "REDEMPTION" ||
    order.order_type?.trim().toUpperCase() === "SWITCH"
  ) {
    const redemptionLabel = formatCybrillaStatusLabel(order.fp_state);
    if (redemptionLabel) return redemptionLabel;
    return formatZyndOrderStatusLabel(order.status);
  }

  return resolvePurchaseOrderStatusLabel(order);
}
