"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { markGatewayReturnKind } from "@/features/invest/lib/mf-payment-gateway-return";
import { notifyMfPaymentGatewayReturn } from "@/features/invest/lib/mf-payment-gateway-popup";
import {
  getLastMfPaymentCheckoutId,
  getLastMfPaymentOrderId,
  getMfPaymentReturnPath,
  markMfPaymentRedirect,
} from "@/features/invest/lib/mf-payment-session";

export function MfPaymentReturnHost() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openCartCheckoutPayment, openOrderPayment } = useMfPaymentOverlay();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || typeof window === "undefined") return;
    handledRef.current = true;

    const checkoutFromQuery =
      searchParams.get("checkout_id") ?? searchParams.get("checkoutId");
    const orderFromQuery = searchParams.get("order_id") ?? searchParams.get("orderId");
    const storedCheckoutId = getLastMfPaymentCheckoutId();
    const storedOrderId = getLastMfPaymentOrderId();
    const checkoutId = checkoutFromQuery ?? storedCheckoutId;
    const orderId = orderFromQuery ?? storedOrderId;

    notifyMfPaymentGatewayReturn({
      search: window.location.search,
      orderId,
      checkoutId,
    });

    try {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
    } catch {
      // ignore
    }

    const useCheckoutReturn =
      Boolean(checkoutFromQuery) || Boolean(storedCheckoutId && !storedOrderId);
    const returnPath =
      getMfPaymentReturnPath() ??
      (useCheckoutReturn ? "/dashboard/mutual-funds/cart" : "/dashboard/mutual-funds");

    if (useCheckoutReturn && checkoutId) {
      markGatewayReturnKind("postback");
      markMfPaymentRedirect({ checkoutId, mode: "full_page" });
      openCartCheckoutPayment(checkoutId, {
        captureReturnPath: false,
        resumeAfterGatewayReturn: true,
      });
    } else if (orderId) {
      markGatewayReturnKind("postback");
      markMfPaymentRedirect({ orderId, mode: "full_page" });
      openOrderPayment(orderId, {
        captureReturnPath: false,
        resumeAfterGatewayReturn: true,
      });
    }

    router.replace(returnPath);
  }, [openCartCheckoutPayment, openOrderPayment, router, searchParams]);

  return null;
}
