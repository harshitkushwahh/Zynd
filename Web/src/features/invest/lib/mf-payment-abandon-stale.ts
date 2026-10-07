import {
  abandonMfCheckoutPayment,
  abandonMfOrderPayment,
  abandonMfSipMandate,
} from "@/features/invest/api/invest-api";

import {
  clearMfLumpsumPaymentSession,
  clearMfSipPaymentSession,
  type MfPendingPaymentResumeTarget,
} from "@/features/invest/lib/mf-payment-session";

/**
 * Silent cancel for a gateway handoff that never came back through the payment dialog.
 * Browser Back and bfcache must not call this — the payment overlay reconciles first and
 * shows success or "Payment was not completed".
 */
export async function abandonStaleMfPaymentResume(
  pending: MfPendingPaymentResumeTarget,
): Promise<void> {
  try {
    if (pending.kind === "order") {
      await abandonMfOrderPayment(pending.orderId);
      clearMfLumpsumPaymentSession(pending.orderId);
      return;
    }
    if (pending.kind === "cart-checkout") {
      await abandonMfCheckoutPayment(pending.checkoutId);
      clearMfLumpsumPaymentSession(pending.checkoutId);
      return;
    }
    await abandonMfSipMandate(pending.planId);
    clearMfSipPaymentSession(pending.planId);
  } catch {
    if (pending.kind === "order") {
      clearMfLumpsumPaymentSession(pending.orderId);
    } else if (pending.kind === "cart-checkout") {
      clearMfLumpsumPaymentSession(pending.checkoutId);
    } else {
      clearMfSipPaymentSession(pending.planId);
    }
  }
}

export function isStaleMfPaymentNavigation(): boolean {
  if (typeof window === "undefined") return false;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload" || nav?.type === "back_forward";
}
