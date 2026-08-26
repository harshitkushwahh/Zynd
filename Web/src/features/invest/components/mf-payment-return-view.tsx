"use client";

import { useSearchParams } from "next/navigation";

import { MfCartPaymentReturnView } from "@/features/invest/components/mf-cart-checkout-pay-view";
import { MfOrderPaymentReturnView } from "@/features/invest/components/mf-order-pay-view";
import {
  getLastMfPaymentCheckoutId,
  getLastMfPaymentOrderId,
} from "@/features/invest/lib/mf-payment-session";

export function MfPaymentReturnView() {
  const searchParams = useSearchParams();
  const checkoutFromQuery =
    searchParams.get("checkout_id") ?? searchParams.get("checkoutId");
  const orderFromQuery = searchParams.get("order_id") ?? searchParams.get("orderId");

  if (checkoutFromQuery) {
    return <MfCartPaymentReturnView />;
  }
  if (orderFromQuery) {
    return <MfOrderPaymentReturnView />;
  }

  const checkoutId = getLastMfPaymentCheckoutId();
  const orderId = getLastMfPaymentOrderId();

  if (checkoutId && !orderId) {
    return <MfCartPaymentReturnView />;
  }

  return <MfOrderPaymentReturnView />;
}
