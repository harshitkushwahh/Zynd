"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { notifyMfPaymentGatewayReturn } from "@/features/invest/lib/mf-payment-gateway-popup";
import {
  getLastMfPaymentPlanId,
  getMfPaymentReturnPath,
} from "@/features/invest/lib/mf-payment-session";

export function MfSipMandateReturnHost() {
  const router = useRouter();
  const { openSipMandate } = useMfPaymentOverlay();
  const planId = getLastMfPaymentPlanId();

  useEffect(() => {
    if (!planId) {
      router.replace("/dashboard/mutual-funds");
      return;
    }

    notifyMfPaymentGatewayReturn({ planId, search: window.location.search });

    try {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
    } catch {
      // ignore
    }

    const returnPath = getMfPaymentReturnPath() ?? "/dashboard/mutual-funds";
    openSipMandate(planId, { captureReturnPath: false });
    router.replace(returnPath);
  }, [openSipMandate, planId, router]);

  return null;
}
