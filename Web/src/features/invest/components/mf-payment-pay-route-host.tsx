"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { getMfPaymentReturnPath } from "@/features/invest/lib/mf-payment-session";

type MfCartCheckoutPayRouteHostProps = {
  checkoutId: string;
};

export function MfCartCheckoutPayRouteHost({ checkoutId }: MfCartCheckoutPayRouteHostProps) {
  const router = useRouter();
  const { openCartCheckoutPayment } = useMfPaymentOverlay();

  useEffect(() => {
    const returnPath = getMfPaymentReturnPath() ?? "/dashboard/mutual-funds/cart";
    openCartCheckoutPayment(checkoutId, { captureReturnPath: false });
    router.replace(returnPath);
  }, [checkoutId, openCartCheckoutPayment, router]);

  return null;
}

type MfOrderPayRouteHostProps = {
  orderId: string;
};

export function MfOrderPayRouteHost({ orderId }: MfOrderPayRouteHostProps) {
  const router = useRouter();
  const { openOrderPayment } = useMfPaymentOverlay();

  useEffect(() => {
    const returnPath = getMfPaymentReturnPath() ?? "/dashboard/mutual-funds";
    openOrderPayment(orderId, { captureReturnPath: false });
    router.replace(returnPath);
  }, [openOrderPayment, orderId, router]);

  return null;
}

type MfSipMandateRouteHostProps = {
  planId: string;
};

export function MfSipMandateRouteHost({ planId }: MfSipMandateRouteHostProps) {
  const router = useRouter();
  const { openSipMandate } = useMfPaymentOverlay();

  useEffect(() => {
    const returnPath = getMfPaymentReturnPath() ?? "/dashboard/mutual-funds/cart";
    openSipMandate(planId, { captureReturnPath: false });
    router.replace(returnPath);
  }, [openSipMandate, planId, router]);

  return null;
}
