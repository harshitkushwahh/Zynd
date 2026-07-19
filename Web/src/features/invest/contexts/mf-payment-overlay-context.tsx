"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { MfCartCheckoutPayView } from "@/features/invest/components/mf-cart-checkout-pay-view";
import { MfOrderPayView } from "@/features/invest/components/mf-order-pay-view";
import { MfSipMandateView } from "@/features/invest/components/mf-sip-mandate-view";
import {
  getLastMfPaymentCheckoutId,
  getLastMfPaymentOrderId,
  getLastMfPaymentPlanId,
  markMfPaymentReturnPath,
  wasMfPaymentRedirected,
} from "@/features/invest/lib/mf-payment-session";

export type MfPaymentOverlayTarget =
  | { kind: "cart-checkout"; checkoutId: string }
  | { kind: "order"; orderId: string }
  | { kind: "sip-mandate"; planId: string };

type OpenPaymentOptions = {
  captureReturnPath?: boolean;
};

type MfPaymentOverlayContextValue = {
  activePayment: MfPaymentOverlayTarget | null;
  openCartCheckoutPayment: (checkoutId: string, options?: OpenPaymentOptions) => void;
  openOrderPayment: (orderId: string, options?: OpenPaymentOptions) => void;
  openSipMandate: (planId: string, options?: OpenPaymentOptions) => void;
  closePayment: () => void;
};

const MfPaymentOverlayContext = createContext<MfPaymentOverlayContextValue | null>(null);

function captureCurrentReturnPath() {
  if (typeof window === "undefined") return;
  markMfPaymentReturnPath(`${window.location.pathname}${window.location.search}`);
}

export function MfPaymentOverlayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activePayment, setActivePayment] = useState<MfPaymentOverlayTarget | null>(null);

  const openCartCheckoutPayment = useCallback(
    (checkoutId: string, options?: OpenPaymentOptions) => {
      if (options?.captureReturnPath !== false) {
        captureCurrentReturnPath();
      }
      setActivePayment({ kind: "cart-checkout", checkoutId });
    },
    [],
  );

  const openOrderPayment = useCallback((orderId: string, options?: OpenPaymentOptions) => {
    if (options?.captureReturnPath !== false) {
      captureCurrentReturnPath();
    }
    setActivePayment({ kind: "order", orderId });
  }, []);

  const openSipMandate = useCallback((planId: string, options?: OpenPaymentOptions) => {
    if (options?.captureReturnPath !== false) {
      captureCurrentReturnPath();
    }
    setActivePayment({ kind: "sip-mandate", planId });
  }, []);

  const closePayment = useCallback(() => {
    setActivePayment(null);
  }, []);

  const resumeAfterGatewayReturn = useCallback(() => {
    setActivePayment((current) => {
      if (current) return current;

      const checkoutId = getLastMfPaymentCheckoutId();
      if (checkoutId && wasMfPaymentRedirected(checkoutId)) {
        return { kind: "cart-checkout", checkoutId };
      }

      const orderId = getLastMfPaymentOrderId();
      if (orderId && wasMfPaymentRedirected(orderId)) {
        return { kind: "order", orderId };
      }

      const planId = getLastMfPaymentPlanId();
      if (planId && wasMfPaymentRedirected(planId)) {
        return { kind: "sip-mandate", planId };
      }

      return null;
    });
  }, []);

  useEffect(() => {
    resumeAfterGatewayReturn();
  }, [pathname, resumeAfterGatewayReturn]);

  useEffect(() => {
    function handlePageShow() {
      resumeAfterGatewayReturn();
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [resumeAfterGatewayReturn]);

  const value = useMemo(
    () => ({
      activePayment,
      openCartCheckoutPayment,
      openOrderPayment,
      openSipMandate,
      closePayment,
    }),
    [
      activePayment,
      closePayment,
      openCartCheckoutPayment,
      openOrderPayment,
      openSipMandate,
    ],
  );

  return (
    <MfPaymentOverlayContext.Provider value={value}>
      {children}
      {activePayment?.kind === "cart-checkout" ? (
        <MfCartCheckoutPayView checkoutId={activePayment.checkoutId} onClose={closePayment} />
      ) : null}
      {activePayment?.kind === "order" ? (
        <MfOrderPayView orderId={activePayment.orderId} onClose={closePayment} />
      ) : null}
      {activePayment?.kind === "sip-mandate" ? (
        <MfSipMandateView planId={activePayment.planId} onClose={closePayment} />
      ) : null}
    </MfPaymentOverlayContext.Provider>
  );
}

export function useMfPaymentOverlay() {
  const context = useContext(MfPaymentOverlayContext);
  if (!context) {
    throw new Error("useMfPaymentOverlay must be used within MfPaymentOverlayProvider");
  }
  return context;
}

export function useMfPaymentOverlayOptional() {
  return useContext(MfPaymentOverlayContext);
}
