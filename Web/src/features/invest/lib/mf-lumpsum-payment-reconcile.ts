import {
  fetchMfCheckoutPaymentStatus,
  fetchMfOrderPaymentStatus,
  type MfCheckout,
  type MfOrder,
  type MfPaymentStatusResponse,
} from "@/features/invest/api/invest-api";

export type MfPaymentReconcileOutcome = MfPaymentStatusResponse["outcome"];

export function isMfPaymentReconcileTerminal(outcome: MfPaymentReconcileOutcome): boolean {
  return outcome === "success" || outcome === "failed";
}

export function shouldKeepPollingPayment(outcome: MfPaymentReconcileOutcome): boolean {
  return outcome === "pending" || outcome === "unclear";
}

export async function reconcileMfOrderPayment(orderId: string): Promise<MfPaymentStatusResponse> {
  return fetchMfOrderPaymentStatus(orderId);
}

export async function reconcileMfCheckoutPayment(checkoutId: string): Promise<MfPaymentStatusResponse> {
  return fetchMfCheckoutPaymentStatus(checkoutId);
}

export function pickOrderFromPaymentStatus(response: MfPaymentStatusResponse): MfOrder | null {
  return response.order ?? null;
}

export function pickCheckoutFromPaymentStatus(response: MfPaymentStatusResponse): MfCheckout | null {
  return response.checkout ?? null;
}
