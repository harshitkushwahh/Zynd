import { describe, expect, it } from "vitest";

import {
  buildMfPaymentGatewayReturnMessage,
  isHttpPaymentGatewayUrl,
  isMfPaymentPopupEnabled,
} from "@/features/invest/lib/mf-payment-gateway-popup";

describe("mf-payment-gateway-popup", () => {
  it("detects HTTPS payment URLs for popup flow", () => {
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

  it("allows disabling popup via env flag", () => {
    const previous = process.env.NEXT_PUBLIC_MF_PAYMENT_FULL_REDIRECT;
    process.env.NEXT_PUBLIC_MF_PAYMENT_FULL_REDIRECT = "1";
    expect(isMfPaymentPopupEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_MF_PAYMENT_FULL_REDIRECT = previous;
  });
});
