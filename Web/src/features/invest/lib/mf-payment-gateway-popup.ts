export const MF_PAYMENT_GATEWAY_POPUP_NAME = "zynd_mf_payment";

export const MF_PAYMENT_GATEWAY_RETURN_MESSAGE = "mf:payment-gateway-return" as const;

/** Same-origin tabs when `window.opener` is missing after gateway redirect. */
export const MF_PAYMENT_RETURN_BROADCAST = "zynd_mf_payment_return" as const;

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 780;

export type MfPaymentGatewayReturnMessage = {
  type: typeof MF_PAYMENT_GATEWAY_RETURN_MESSAGE;
  search: string;
  orderId?: string | null;
  checkoutId?: string | null;
  planId?: string | null;
};

/** HTTPS checkout uses same-tab redirect unless popup is explicitly enabled. */
export function isMfPaymentPopupEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.NEXT_PUBLIC_MF_PAYMENT_FULL_REDIRECT === "1") return false;
  return process.env.NEXT_PUBLIC_MF_PAYMENT_POPUP === "1";
}

export function isHttpPaymentGatewayUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith("https://") || trimmed.startsWith("http://");
}

function popupFeatures(): string {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2));
  return [
    "popup=yes",
    `width=${POPUP_WIDTH}`,
    `height=${POPUP_HEIGHT}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
}

function uniquePopupWindowName(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${MF_PAYMENT_GATEWAY_POPUP_NAME}_${Date.now().toString(36)}_${suffix}`;
}

export function openMfPaymentGatewayPopup(initialUrl = "about:blank"): Window | null {
  if (typeof window === "undefined") return null;
  try {
    return window.open(initialUrl, uniquePopupWindowName(), popupFeatures());
  } catch {
    return null;
  }
}

export function navigateMfPaymentGatewayPopup(popup: Window | null, url: string): boolean {
  const target = url.trim();
  if (!popup || popup.closed || !target) return false;
  try {
    popup.location.href = target;
    popup.focus();
    return true;
  } catch {
    return false;
  }
}

export function closeMfPaymentGatewayPopup(popup: Window | null): void {
  if (!popup || popup.closed) return;
  try {
    popup.close();
  } catch {
    // ignore
  }
}

export function buildMfPaymentGatewayReturnMessage(args: {
  search?: string;
  orderId?: string | null;
  checkoutId?: string | null;
  planId?: string | null;
}): MfPaymentGatewayReturnMessage {
  const search =
    args.search ??
    (typeof window !== "undefined" ? window.location.search : "");
  return {
    type: MF_PAYMENT_GATEWAY_RETURN_MESSAGE,
    search: search.startsWith("?") ? search : search ? `?${search}` : "",
    orderId: args.orderId ?? null,
    checkoutId: args.checkoutId ?? null,
    planId: args.planId ?? null,
  };
}

export function notifyMfPaymentGatewayReturn(args: {
  search?: string;
  orderId?: string | null;
  checkoutId?: string | null;
  planId?: string | null;
}): void {
  if (typeof window === "undefined") return;
  const message = buildMfPaymentGatewayReturnMessage(args);
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin);
    }
  } catch {
    // ignore
  }
  try {
    const channel = new BroadcastChannel(MF_PAYMENT_RETURN_BROADCAST);
    channel.postMessage(message);
    channel.close();
  } catch {
    // ignore
  }
}

function matchesPaymentReturnTarget(
  message: MfPaymentGatewayReturnMessage,
  target: { orderId?: string; checkoutId?: string; planId?: string },
): boolean {
  if (target.orderId && message.orderId && message.orderId !== target.orderId) return false;
  if (target.checkoutId && message.checkoutId && message.checkoutId !== target.checkoutId) {
    return false;
  }
  if (target.planId && message.planId && message.planId !== target.planId) return false;
  return true;
}

export function subscribeMfPaymentGatewayReturn(
  target: { orderId?: string; checkoutId?: string; planId?: string },
  handler: (message: MfPaymentGatewayReturnMessage) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as MfPaymentGatewayReturnMessage | undefined;
    if (!data || data.type !== MF_PAYMENT_GATEWAY_RETURN_MESSAGE) return;
    if (!matchesPaymentReturnTarget(data, target)) return;
    handler(data);
  };

  window.addEventListener("message", onMessage);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(MF_PAYMENT_RETURN_BROADCAST);
    channel.onmessage = (event: MessageEvent<MfPaymentGatewayReturnMessage>) => {
      const data = event.data;
      if (!data || data.type !== MF_PAYMENT_GATEWAY_RETURN_MESSAGE) return;
      if (!matchesPaymentReturnTarget(data, target)) return;
      handler(data);
    };
  } catch {
    channel = null;
  }

  return () => {
    window.removeEventListener("message", onMessage);
    if (channel) {
      channel.close();
    }
  };
}

export type LaunchMfPaymentGatewayResult = "popup" | "blocked" | "same_tab";

/** Open Finprim/ONDC checkout in a centered popup for HTTPS; UPI deep links use same-tab navigation. */
export function launchMfPaymentGatewayUrl(url: string): {
  result: LaunchMfPaymentGatewayResult;
  popup: Window | null;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return { result: "blocked", popup: null };
  }

  if (!isHttpPaymentGatewayUrl(trimmed)) {
    window.location.href = trimmed;
    return { result: "same_tab", popup: null };
  }

  if (!isMfPaymentPopupEnabled()) {
    window.location.href = trimmed;
    return { result: "same_tab", popup: null };
  }

  const popup = openMfPaymentGatewayPopup("about:blank");
  if (popup && navigateMfPaymentGatewayPopup(popup, trimmed)) {
    return { result: "popup", popup };
  }

  return { result: "blocked", popup: null };
}
