const REDIRECT_KEY_PREFIX = "mf-payment-redirected-";
const SIP_MANDATE_REDIRECT_PREFIX = "mf-sip-mandate-redirected-";
const SIP_FIRST_INSTALLMENT_REDIRECT_PREFIX = "mf-sip-first-installment-redirected-";
const LAST_ORDER_KEY = "mf-payment-last-order-id";
const LAST_CHECKOUT_KEY = "mf-payment-last-checkout-id";
const LAST_PLAN_KEY = "mf-payment-last-plan-id";
const SIP_CART_PLAN_IDS_KEY = "mf-payment-sip-cart-plan-ids";
const RETURN_PATH_KEY = "mf-payment-return-path";

export function markMfPaymentRedirect(target: { orderId?: string; checkoutId?: string; planId?: string }) {
  if (typeof window === "undefined") return;
  if (target.orderId) {
    sessionStorage.setItem(`${REDIRECT_KEY_PREFIX}${target.orderId}`, Date.now().toString());
    sessionStorage.setItem(LAST_ORDER_KEY, target.orderId);
  }
  if (target.checkoutId) {
    sessionStorage.setItem(`${REDIRECT_KEY_PREFIX}${target.checkoutId}`, Date.now().toString());
    sessionStorage.setItem(LAST_CHECKOUT_KEY, target.checkoutId);
  }
  if (target.planId) {
    sessionStorage.setItem(`${REDIRECT_KEY_PREFIX}${target.planId}`, Date.now().toString());
    sessionStorage.setItem(LAST_PLAN_KEY, target.planId);
  }
}

export function wasMfPaymentRedirected(id: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${REDIRECT_KEY_PREFIX}${id}`) !== null;
}

export function clearMfPaymentRedirect(id: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${REDIRECT_KEY_PREFIX}${id}`);
}

export function markMfSipMandateRedirect(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${SIP_MANDATE_REDIRECT_PREFIX}${planId}`, Date.now().toString());
  sessionStorage.setItem(LAST_PLAN_KEY, planId);
  markMfPaymentRedirect({ planId });
}

export function wasMfSipMandateRedirected(planId: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${SIP_MANDATE_REDIRECT_PREFIX}${planId}`) !== null;
}

export function clearMfSipMandateRedirect(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${SIP_MANDATE_REDIRECT_PREFIX}${planId}`);
  clearMfPaymentRedirect(planId);
}

export function markMfSipFirstInstallmentRedirect(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${SIP_FIRST_INSTALLMENT_REDIRECT_PREFIX}${planId}`, Date.now().toString());
  sessionStorage.setItem(LAST_PLAN_KEY, planId);
}

export function wasMfSipFirstInstallmentRedirected(planId: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${SIP_FIRST_INSTALLMENT_REDIRECT_PREFIX}${planId}`) !== null;
}

export function clearMfSipFirstInstallmentRedirect(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${SIP_FIRST_INSTALLMENT_REDIRECT_PREFIX}${planId}`);
}

export function clearMfSipPaymentSession(planId: string) {
  clearMfSipMandateRedirect(planId);
  clearMfSipFirstInstallmentRedirect(planId);
  clearMfSipFirstInstallmentAutoStarted(planId);
  clearMfPaymentRedirect(planId);
  markMfSipPaymentDismissed(planId);
  if (typeof window !== "undefined" && getLastMfPaymentPlanId() === planId) {
    sessionStorage.removeItem(LAST_PLAN_KEY);
  }
}

const SIP_FIRST_INSTALLMENT_AUTO_PREFIX = "mf-sip-first-installment-auto-";
const SIP_PAYMENT_DISMISSED_PREFIX = "mf-sip-payment-dismissed-";

export function markMfSipPaymentDismissed(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${SIP_PAYMENT_DISMISSED_PREFIX}${planId}`, "1");
}

export function wasMfSipPaymentDismissed(planId: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${SIP_PAYMENT_DISMISSED_PREFIX}${planId}`) === "1";
}

export function clearMfSipPaymentDismissed(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${SIP_PAYMENT_DISMISSED_PREFIX}${planId}`);
}

export function clearMfSipFirstInstallmentAutoStarted(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${SIP_FIRST_INSTALLMENT_AUTO_PREFIX}${planId}`);
}

export function markMfSipFirstInstallmentAutoStarted(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${SIP_FIRST_INSTALLMENT_AUTO_PREFIX}${planId}`, "1");
}

export function wasMfSipFirstInstallmentAutoStarted(planId: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${SIP_FIRST_INSTALLMENT_AUTO_PREFIX}${planId}`) === "1";
}

export function getLastMfPaymentOrderId() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LAST_ORDER_KEY);
}

export function getLastMfPaymentCheckoutId() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LAST_CHECKOUT_KEY);
}

export function getLastMfPaymentPlanId() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LAST_PLAN_KEY);
}

export function markMfSipCartCheckoutPlans(planIds: string[]) {
  if (typeof window === "undefined") return;
  if (planIds.length === 0) return;
  sessionStorage.setItem(SIP_CART_PLAN_IDS_KEY, JSON.stringify(planIds));
  sessionStorage.setItem(LAST_PLAN_KEY, planIds[0] ?? "");
}

export function getMfSipCartCheckoutPlanIds() {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(SIP_CART_PLAN_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function removeMfSipCartCheckoutPlan(planId: string) {
  const remaining = getMfSipCartCheckoutPlanIds().filter((id) => id !== planId);
  if (remaining.length === 0) {
    clearMfSipCartCheckoutPlans();
    return;
  }
  markMfSipCartCheckoutPlans(remaining);
}

export function getNextMfSipCartCheckoutPlanId(afterPlanId?: string | null) {
  const planIds = getMfSipCartCheckoutPlanIds();
  if (planIds.length === 0) return null;
  if (!afterPlanId) return planIds[0] ?? null;
  const index = planIds.indexOf(afterPlanId);
  if (index === -1) return planIds[0] ?? null;
  return planIds[index + 1] ?? null;
}

export function clearMfSipCartCheckoutPlans() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SIP_CART_PLAN_IDS_KEY);
}

export function markMfPaymentReturnPath(path: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RETURN_PATH_KEY, path);
}

export function getMfPaymentReturnPath() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(RETURN_PATH_KEY);
}

export function clearMfPaymentReturnPath() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RETURN_PATH_KEY);
}

export function clearLastMfPaymentSession() {
  if (typeof window === "undefined") return;
  const orderId = getLastMfPaymentOrderId();
  const checkoutId = getLastMfPaymentCheckoutId();
  const planId = getLastMfPaymentPlanId();
  if (orderId) {
    clearMfPaymentRedirect(orderId);
    sessionStorage.removeItem(LAST_ORDER_KEY);
  }
  if (checkoutId) {
    clearMfPaymentRedirect(checkoutId);
    sessionStorage.removeItem(LAST_CHECKOUT_KEY);
  }
  if (planId) {
    clearMfPaymentRedirect(planId);
    sessionStorage.removeItem(LAST_PLAN_KEY);
  }
  clearMfSipCartCheckoutPlans();
  clearMfPaymentReturnPath();
}
