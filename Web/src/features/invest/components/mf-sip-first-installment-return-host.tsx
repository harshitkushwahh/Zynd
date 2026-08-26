"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { getMfPaymentReturnPath } from "@/features/invest/lib/mf-payment-session";

export function MfSipFirstInstallmentReturnHost() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openSipMandate } = useMfPaymentOverlay();
  const planId = searchParams.get("plan_id");

  useEffect(() => {
    if (!planId) {
      router.replace("/dashboard/mutual-funds");
      return;
    }

    const returnPath = getMfPaymentReturnPath() ?? "/dashboard/mutual-funds";
    openSipMandate(planId, { captureReturnPath: false });
    router.replace(returnPath);
  }, [openSipMandate, planId, router]);

  return null;
}
