"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { MfCartPaymentReturnView } from "@/features/invest/components/mf-cart-checkout-pay-view";
import { MfOrderPaymentReturnView } from "@/features/invest/components/mf-order-pay-view";
import { notifyMfPaymentGatewayReturn } from "@/features/invest/lib/mf-payment-gateway-popup";
import {
  getLastMfPaymentCheckoutId,
  getLastMfPaymentOrderId,
} from "@/features/invest/lib/mf-payment-session";

function MfPaymentGatewayReturnBridge({
  orderId,
  checkoutId,
}: {
  orderId?: string | null;
  checkoutId?: string | null;
}) {
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (notifiedRef.current || typeof window === "undefined") return;
    notifiedRef.current = true;
    notifyMfPaymentGatewayReturn({
      search: window.location.search,
      orderId,
      checkoutId,
    });
    if (window.opener && !window.opener.closed) {
      try {
        window.close();
      } catch {
        // ignore
      }
    }
  }, [checkoutId, orderId]);

  return null;
}

export function MfPaymentReturnView() {
  const searchParams = useSearchParams();
  const checkoutFromQuery =
    searchParams.get("checkout_id") ?? searchParams.get("checkoutId");
  const orderFromQuery = searchParams.get("order_id") ?? searchParams.get("orderId");

  const storedCheckoutId = getLastMfPaymentCheckoutId();
  const storedOrderId = getLastMfPaymentOrderId();
  const bridgeOrderId = orderFromQuery ?? storedOrderId;
  const bridgeCheckoutId = checkoutFromQuery ?? storedCheckoutId;

  const bridge = (
    <MfPaymentGatewayReturnBridge
      orderId={bridgeOrderId}
      checkoutId={bridgeCheckoutId}
    />
  );

  if (checkoutFromQuery) {
    return (
      <>
        {bridge}
        <MfCartPaymentReturnView />
      </>
    );
  }
  if (orderFromQuery) {
    return (
      <>
        {bridge}
        <MfOrderPaymentReturnView />
      </>
    );
  }

  if (storedCheckoutId && !storedOrderId) {
    return (
      <>
        {bridge}
        <MfCartPaymentReturnView />
      </>
    );
  }

  return (
    <>
      {bridge}
      <MfOrderPaymentReturnView />
    </>
  );
}
