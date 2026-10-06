import type { MfOrder, MfOrderEvent } from "@/features/invest/api/invest-api";

/** Fields used for investor-facing purchase order status labels and badges. */
export type MfOrderInvestorStatusContext = Pick<
  MfOrder,
  "status" | "fp_state" | "fp_payment_status" | "payment_completed" | "order_type"
> &
  Partial<Pick<MfOrder, "failure_code">>;

function payloadString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isOrderPaymentCompleted(
  order: Pick<MfOrder, "status" | "payment_completed"> & Partial<Pick<MfOrder, "order_type">>,
  events: MfOrderEvent[] = [],
) {
  if (order.order_type?.trim().toUpperCase() === "REDEMPTION") return true;
  if (order.payment_completed === true) return true;
  if (order.status?.toUpperCase() === "SUCCEEDED") return true;

  return events.some((event) => {
    const stage = payloadString(event.payload?.stage);
    const repair = payloadString(event.payload?.repair);
    return (
      stage === "payment_success" ||
      repair === "abandoned_paid" ||
      (event.source?.toUpperCase() === "RECONCILE" && repair === "abandoned_paid")
    );
  });
}

const TERMINAL_PAYMENT_FAILURE_STATUSES = new Set([
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REJECTED",
  "DECLINED",
]);

export function isMfPurchaseOrderPaymentFailed(
  order: Pick<MfOrder, "status" | "fp_payment_status" | "payment_completed" | "order_type"> &
    Partial<Pick<MfOrder, "failure_code">>,
): boolean {
  if (order.order_type?.trim().toUpperCase() === "REDEMPTION") return false;
  if (isOrderPaymentCompleted(order)) return false;

  const status = order.status?.trim().toUpperCase() ?? "";
  if (status === "FAILED" || status === "CANCELLED") return true;

  const paymentStatus = order.fp_payment_status?.trim().toUpperCase() ?? "";
  return TERMINAL_PAYMENT_FAILURE_STATUSES.has(paymentStatus);
}

/** Lumpsum/SIP purchase still waiting on gateway payment (investor-facing "Pending"). */
export function isMfPurchaseOrderAwaitingPayment(order: MfOrderInvestorStatusContext): boolean {
  if (order.order_type?.trim().toUpperCase() === "REDEMPTION") return false;
  if (isOrderPaymentCompleted(order)) return false;
  if (isMfPurchaseOrderPaymentFailed(order)) return false;

  const status = order.status?.trim().toUpperCase() ?? "";
  if (status === "SUCCEEDED") return false;

  return true;
}

export function isOrderAwaitingAllotment(
  order: Pick<MfOrder, "status" | "fp_state" | "payment_completed"> & Partial<Pick<MfOrder, "order_type">>,
  events: MfOrderEvent[] = [],
) {
  if (order.order_type?.trim().toUpperCase() === "REDEMPTION") return false;
  if (!isOrderPaymentCompleted(order, events)) return false;

  const status = order.status.trim().toUpperCase();
  if (status === "SUBMITTED") return true;
  if (status === "PROCESSING" && order.fp_state?.toLowerCase() === "submitted") return true;
  return false;
}
