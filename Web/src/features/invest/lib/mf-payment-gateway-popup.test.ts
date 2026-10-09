import { describe, expect, it } from "vitest";

import {
  buildMfPaymentGatewayReturnMessage,
  isHttpPaymentGatewayUrl,
  isMfPaymentPopupEnabled,
} from "@/features/invest/lib/mf-payment-gateway-popup";

describe("mf-payment-gateway-popup", () => {
  it("detects HTTPS payment URLs for gateway checkout", () => {
    expect(isHttpPaymentGatewayUrl("https://pay.example/ondc")).toBe(true);
    expect(isHttpPaymentGatewayUrl("http://localhost/gateway")).toBe(true);
    expect(isHttpPaymentGatewayUrl("upi://pay?pa=test@bank")).toBe(false);
  });

  it("builds return postMessage payload", () => {
    const message = buildMfPaymentGatewayReturnMessage({
      search: "order_id=abc",
      orderId: "abc",
    });
    expect(message.type).toBe("mf:payment-gateway-return");
    expect(message.search).toBe("?order_id=abc");
    expect(message.orderId).toBe("abc");
  });

  it("uses same-tab redirect unless popup is explicitly enabled", () => {
    const previousRedirect = process.env.NEXT_PUBLIC_MF_PAYMENT_FULL_REDIRECT;
    const previousPopup = process.env.NEXT_PUBLIC_MF_PAYMENT_POPUP;
    delete process.env.NEXT_PUBLIC_MF_PAYMENT_FULL_REDIRECT;
    delete process.env.NEXT_PUBLIC_MF_PAYMENT_POPUP;
    expect(isMfPaymentPopupEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_MF_PAYMENT_POPUP = "1";
    expect(isMfPaymentPopupEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_MF_PAYMENT_FULL_REDIRECT = "1";
    expect(isMfPaymentPopupEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_MF_PAYMENT_FULL_REDIRECT = previousRedirect;
    process.env.NEXT_PUBLIC_MF_PAYMENT_POPUP = previousPopup;
  });
});
