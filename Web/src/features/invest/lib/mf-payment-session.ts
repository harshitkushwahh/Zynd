const REDIRECT_KEY_PREFIX = "mf-payment-redirected-";
const LUMPSUM_DISMISSED_PREFIX = "mf-lumpsum-payment-dismissed-";
const SIP_MANDATE_REDIRECT_PREFIX = "mf-sip-mandate-redirected-";
const SIP_MANDATE_AUTO_REDIRECT_BLOCKED_PREFIX = "mf-sip-mandate-auto-redirect-blocked-";
const SIP_FIRST_INSTALLMENT_REDIRECT_PREFIX = "mf-sip-first-installment-redirected-";
const LAST_ORDER_KEY = "mf-payment-last-order-id";
const LAST_CHECKOUT_KEY = "mf-payment-last-checkout-id";
const LAST_PLAN_KEY = "mf-payment-last-plan-id";
const SIP_CART_PLAN_IDS_KEY = "mf-payment-sip-cart-plan-ids";
const RETURN_PATH_KEY = "mf-payment-return-path";
const GATEWAY_MODE_PREFIX = "mf-payment-gateway-mode-";

export type MfPaymentGatewayMode = "popup" | "full_page";

export function markMfPaymentRedirect(target: {
  orderId?: string;
  checkoutId?: string;
  planId?: string;
  mode?: MfPaymentGatewayMode;
}) {
  if (typeof window === "undefined") return;
  if (!getMfPaymentReturnPath()) {
    markMfPaymentReturnPath(`${window.location.pathname}${window.location.search}`);
  }
  const mode: MfPaymentGatewayMode = target.mode ?? "full_page";
  if (target.orderId) {
    sessionStorage.setItem(`${REDIRECT_KEY_PREFIX}${target.orderId}`, Date.now().toString());
    sessionStorage.setItem(`${GATEWAY_MODE_PREFIX}${target.orderId}`, mode);
    sessionStorage.setItem(LAST_ORDER_KEY, target.orderId);
  }
  if (target.checkoutId) {
    sessionStorage.setItem(`${REDIRECT_KEY_PREFIX}${target.checkoutId}`, Date.now().toString());
    sessionStorage.setItem(`${GATEWAY_MODE_PREFIX}${target.checkoutId}`, mode);
    sessionStorage.setItem(LAST_CHECKOUT_KEY, target.checkoutId);
  }
  if (target.planId) {
    sessionStorage.setItem(`${REDIRECT_KEY_PREFIX}${target.planId}`, Date.now().toString());
    sessionStorage.setItem(`${GATEWAY_MODE_PREFIX}${target.planId}`, mode);
    sessionStorage.setItem(LAST_PLAN_KEY, target.planId);
  }
}

export function getMfPaymentGatewayMode(id: string): MfPaymentGatewayMode | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`${GATEWAY_MODE_PREFIX}${id}`);
  return raw === "popup" || raw === "full_page" ? raw : null;
}

export function clearMfPaymentGatewayMode(id: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${GATEWAY_MODE_PREFIX}${id}`);
}

export function wasMfPaymentRedirected(id: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${REDIRECT_KEY_PREFIX}${id}`) !== null;
}

export function clearMfPaymentRedirect(id: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${REDIRECT_KEY_PREFIX}${id}`);
  clearMfPaymentGatewayMode(id);
}

/** Clears every in-flight gateway redirect marker (fresh Invest must not inherit a prior order). */
export function clearAllMfPaymentRedirectFlags() {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(REDIRECT_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    sessionStorage.removeItem(key);
  }
  const modeKeys: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(GATEWAY_MODE_PREFIX)) {
      modeKeys.push(key);
    }
  }
  for (const key of modeKeys) {
    sessionStorage.removeItem(key);
  }
}

export function markMfLumpsumPaymentDismissed(id: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${LUMPSUM_DISMISSED_PREFIX}${id}`, "1");
}

export function wasMfLumpsumPaymentDismissed(id: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${LUMPSUM_DISMISSED_PREFIX}${id}`) === "1";
}

export function clearMfLumpsumPaymentDismissed(id: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${LUMPSUM_DISMISSED_PREFIX}${id}`);
}

export function clearMfLumpsumPaymentSession(id: string) {
  clearMfPaymentRedirect(id);
  clearMfLumpsumPaymentDismissed(id);
}

export function markMfSipMandateRedirect(planId: string, mode: MfPaymentGatewayMode = "full_page") {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${SIP_MANDATE_REDIRECT_PREFIX}${planId}`, Date.now().toString());
  sessionStorage.setItem(LAST_PLAN_KEY, planId);
  markMfPaymentRedirect({ planId, mode });
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

/** After gateway return, Cybrilla auth URLs are one-time — do not auto-redirect again. */
export function markMfSipMandateAutoRedirectBlocked(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${SIP_MANDATE_AUTO_REDIRECT_BLOCKED_PREFIX}${planId}`, "1");
}

export function wasMfSipMandateAutoRedirectBlocked(planId: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${SIP_MANDATE_AUTO_REDIRECT_BLOCKED_PREFIX}${planId}`) === "1";
}

export function clearMfSipMandateAutoRedirectBlocked(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${SIP_MANDATE_AUTO_REDIRECT_BLOCKED_PREFIX}${planId}`);
}

export function markMfSipFirstInstallmentRedirect(
  planId: string,
  mode: MfPaymentGatewayMode = "full_page",
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${SIP_FIRST_INSTALLMENT_REDIRECT_PREFIX}${planId}`, Date.now().toString());
  sessionStorage.setItem(LAST_PLAN_KEY, planId);
  markMfPaymentRedirect({ planId, mode });
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
  clearMfSipMandateAutoRedirectBlocked(planId);
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

export type MfPendingPaymentResumeTarget =
  | { kind: "cart-checkout"; checkoutId: string }
  | { kind: "order"; orderId: string }
  | { kind: "sip-mandate"; planId: string };

function shouldResumeAfterFullPageGateway(id: string) {
  const mode = getMfPaymentGatewayMode(id);
  return mode === null || mode === "full_page";
}

/** True when user left the tab for a full-page gateway and we should treat mount as a return. */
export function isMfPaymentFullPageGatewayReturn(id: string): boolean {
  return wasMfPaymentRedirected(id) && shouldResumeAfterFullPageGateway(id);
}

export function getPendingMfPaymentResumeTarget(): MfPendingPaymentResumeTarget | null {
  if (typeof window === "undefined") return null;

  const checkoutId = getLastMfPaymentCheckoutId();
  if (
    checkoutId &&
    wasMfPaymentRedirected(checkoutId) &&
    !wasMfLumpsumPaymentDismissed(checkoutId) &&
    shouldResumeAfterFullPageGateway(checkoutId)
  ) {
    return { kind: "cart-checkout", checkoutId };
  }

  const orderId = getLastMfPaymentOrderId();
  if (
    orderId &&
    wasMfPaymentRedirected(orderId) &&
    !wasMfLumpsumPaymentDismissed(orderId) &&
    shouldResumeAfterFullPageGateway(orderId)
  ) {
    return { kind: "order", orderId };
  }

  const planId = getLastMfPaymentPlanId();
  const pendingMandate = planId ? wasMfSipMandateRedirected(planId) : false;
  const pendingFirst = planId ? wasMfSipFirstInstallmentRedirected(planId) : false;
  if (
    planId &&
    (pendingMandate || pendingFirst) &&
    !wasMfSipPaymentDismissed(planId) &&
    shouldResumeAfterFullPageGateway(planId)
  ) {
    return { kind: "sip-mandate", planId };
  }

  return null;
}

export function isMfPaymentGatewayReturnRoute(pathname: string): boolean {
  return (
    pathname.includes("/orders/payment-return") ||
    pathname.includes("/sip/mandate-return") ||
    pathname.includes("/sip/first-installment-return") ||
    (pathname.includes("/orders/") && pathname.endsWith("/pay")) ||
    (pathname.includes("/cart/") && pathname.endsWith("/pay"))
  );
}

export function clearLastMfPaymentSession() {
  if (typeof window === "undefined") return;
  const orderId = getLastMfPaymentOrderId();
  const checkoutId = getLastMfPaymentCheckoutId();
  const planId = getLastMfPaymentPlanId();
  if (orderId) {
    clearMfPaymentRedirect(orderId);
    clearMfLumpsumPaymentDismissed(orderId);
    sessionStorage.removeItem(LAST_ORDER_KEY);
  }
  if (checkoutId) {
    clearMfPaymentRedirect(checkoutId);
    clearMfLumpsumPaymentDismissed(checkoutId);
    sessionStorage.removeItem(LAST_CHECKOUT_KEY);
  }
  if (planId) {
    clearMfPaymentRedirect(planId);
    sessionStorage.removeItem(LAST_PLAN_KEY);
  }
  clearMfSipCartCheckoutPlans();
  clearMfPaymentReturnPath();
}

/** Call before POST /invest/orders so a new attempt does not inherit redirect/resume state. */
export function clearMfPaymentSessionBeforeNewInvest() {
  if (typeof window === "undefined") return;
  clearAllMfPaymentRedirectFlags();
  clearLastMfPaymentSession();
}

/** Start a fresh lumpsum payment overlay without stale redirect/resume state from prior orders. */
export function beginMfOrderPaymentSession(orderId: string) {
  if (typeof window === "undefined") return;
  const returnPath = getMfPaymentReturnPath();
  clearAllMfPaymentRedirectFlags();
  clearLastMfPaymentSession();
  clearMfLumpsumPaymentDismissed(orderId);
  sessionStorage.setItem(LAST_ORDER_KEY, orderId);
  if (returnPath) {
    markMfPaymentReturnPath(returnPath);
  }
}

/** Start a fresh cart checkout payment overlay without stale redirect/resume state. */
export function beginMfCartCheckoutPaymentSession(checkoutId: string) {
  if (typeof window === "undefined") return;
  const returnPath = getMfPaymentReturnPath();
  clearAllMfPaymentRedirectFlags();
  clearLastMfPaymentSession();
  clearMfLumpsumPaymentDismissed(checkoutId);
  sessionStorage.setItem(LAST_CHECKOUT_KEY, checkoutId);
  if (returnPath) {
    markMfPaymentReturnPath(returnPath);
  }
}
