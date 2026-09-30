import type { MfOrder, MfOrderEvent } from "@/features/invest/api/invest-api";

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
