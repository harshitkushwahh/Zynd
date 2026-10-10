const OVERLAY_RESUME_KEY = "mf-payment-overlay-resume";
const RETURN_KIND_KEY = "mf-payment-gateway-return-kind";

/** One reconcile after browser Back, then abandon if payment is still pending. */
export const MF_GATEWAY_BACK_RECONCILE_ATTEMPTS = 1;

export type MfGatewayReturnKind = "history" | "postback";

export type MfPaymentNavigationType = "navigate" | "reload" | "back_forward" | "prerender" | null;

export type MfGatewayNavigationAction = "resume" | "ignore";

export function readNavigationType(): MfPaymentNavigationType {
  if (typeof window === "undefined" || typeof performance === "undefined") return null;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const type = nav?.type;
    if (type === "navigate" || type === "reload" || type === "back_forward" || type === "prerender") {
      return type;
    }
  } catch {
    /* ignore */
  }
  try {
    const legacy = performance.navigation;
    if (legacy?.type === 2) return "back_forward";
    if (legacy?.type === 1) return "reload";
  } catch {
    /* ignore */
  }
  return null;
}

export function isHistoryBackForwardNavigation(): boolean {
  return readNavigationType() === "back_forward";
}

/** Browser Back or bfcache restore from the full-page gateway. */
export function isHistoryGatewayReturn(event?: PageTransitionEvent): boolean {
  if (event?.persisted === true) return true;
  return isHistoryBackForwardNavigation();
}

export function markMfPaymentOverlayResume() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(OVERLAY_RESUME_KEY, "1");
}

export function hasMfPaymentOverlayResume() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(OVERLAY_RESUME_KEY) === "1";
}

export function markGatewayReturnKind(kind: MfGatewayReturnKind) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RETURN_KIND_KEY, kind);
}

export function getGatewayReturnKind(): MfGatewayReturnKind | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(RETURN_KIND_KEY);
  return raw === "history" || raw === "postback" ? raw : null;
}

export function clearMfGatewayReturnMarkers() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(OVERLAY_RESUME_KEY);
  sessionStorage.removeItem(RETURN_KIND_KEY);
}

/**
 * Full-page gateway handoff is still in session.
 * Resume the payment dialog on Back, bfcache, reload, or an explicit postback resume.
 * Do not treat a normal in-app navigation as a return — that used to cancel in-review orders
 * before the investor ever reached Cybrilla.
 */
export function resolveGatewayNavigationAction(args: {
  onGatewayReturnRoute: boolean;
  hasPendingResume: boolean;
  navigationType: MfPaymentNavigationType;
  persisted?: boolean;
  forceResume?: boolean;
}): MfGatewayNavigationAction {
  if (args.onGatewayReturnRoute || !args.hasPendingResume) return "ignore";
  if (
    args.forceResume ||
    args.persisted ||
    args.navigationType === "back_forward" ||
    args.navigationType === "reload"
  ) {
    return "resume";
  }
  return "ignore";
}

export function shouldMarkHistoryGatewayReturn(args: {
  persisted?: boolean;
  navigationType: MfPaymentNavigationType;
}): boolean {
  return args.persisted === true || args.navigationType === "back_forward";
}

export type GatewayBackReconcileOutcome = "success" | "failed" | "pending" | "unclear" | null;

/** After a short reconcile window, Back without a terminal success is payment-not-completed. */
export function shouldShowGatewayBackNotCompleted(args: {
  historyReturn: boolean;
  attempts: number;
  outcome: GatewayBackReconcileOutcome;
  maxAttempts?: number;
}): boolean {
  if (!args.historyReturn) return false;
  if (args.outcome === "success" || args.outcome === "failed") return false;
  const maxAttempts = args.maxAttempts ?? MF_GATEWAY_BACK_RECONCILE_ATTEMPTS;
  return args.attempts >= maxAttempts;
}

export function shouldAbandonPaymentOnDismiss(args: {
  isTerminal: boolean;
  paymentSucceeded: boolean;
  paymentStarted: boolean;
}) {
  return !args.isTerminal && !args.paymentSucceeded && args.paymentStarted;
}
