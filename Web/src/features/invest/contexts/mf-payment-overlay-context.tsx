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
  abandonStaleMfPaymentResume,
  isStaleMfPaymentNavigation,
} from "@/features/invest/lib/mf-payment-abandon-stale";
import {
  beginMfCartCheckoutPaymentSession,
  beginMfOrderPaymentSession,
  clearMfLumpsumPaymentDismissed,
  clearMfLumpsumPaymentSession,
  clearMfSipPaymentSession,
  clearMfSipPaymentDismissed,
  getPendingMfPaymentResumeTarget,
  isMfPaymentGatewayReturnRoute,
  markMfPaymentReturnPath,
} from "@/features/invest/lib/mf-payment-session";

export type MfPaymentOverlayTarget =
  | { kind: "cart-checkout"; checkoutId: string }
  | { kind: "order"; orderId: string }
  | { kind: "sip-mandate"; planId: string };

type OpenPaymentOptions = {
  captureReturnPath?: boolean;
  /** Set when resuming after a full-page gateway return (keeps session redirect flag). */
  resumeAfterGatewayReturn?: boolean;
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
      if (options?.resumeAfterGatewayReturn) {
        clearMfLumpsumPaymentDismissed(checkoutId);
      } else {
        beginMfCartCheckoutPaymentSession(checkoutId);
      }
      setActivePayment({ kind: "cart-checkout", checkoutId });
    },
    [],
  );

  const openOrderPayment = useCallback((orderId: string, options?: OpenPaymentOptions) => {
    if (options?.captureReturnPath !== false) {
      captureCurrentReturnPath();
    }
    if (options?.resumeAfterGatewayReturn) {
      clearMfLumpsumPaymentDismissed(orderId);
    } else {
      beginMfOrderPaymentSession(orderId);
    }
    setActivePayment({ kind: "order", orderId });
  }, []);

  const openSipMandate = useCallback((planId: string, options?: OpenPaymentOptions) => {
    if (options?.captureReturnPath !== false) {
      captureCurrentReturnPath();
    }
    clearMfSipPaymentDismissed(planId);
    setActivePayment({ kind: "sip-mandate", planId });
  }, []);

  const closePayment = useCallback(() => {
    if (activePayment?.kind === "sip-mandate") {
      clearMfSipPaymentSession(activePayment.planId);
    } else if (activePayment?.kind === "order") {
      clearMfLumpsumPaymentSession(activePayment.orderId);
    } else if (activePayment?.kind === "cart-checkout") {
      clearMfLumpsumPaymentSession(activePayment.checkoutId);
    }
    setActivePayment(null);
  }, [activePayment]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isMfPaymentGatewayReturnRoute(pathname)) return;

    const pending = getPendingMfPaymentResumeTarget();
    if (!pending) return;
    if (!isStaleMfPaymentNavigation()) return;

    void abandonStaleMfPaymentResume(pending);
  }, [pathname]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (isMfPaymentGatewayReturnRoute(pathname)) return;
      const pending = getPendingMfPaymentResumeTarget();
      if (!pending) return;
      if (!event.persisted && !isStaleMfPaymentNavigation()) return;
      void abandonStaleMfPaymentResume(pending);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [pathname]);

  const value = useMemo(
    () => ({
      activePayment,
      openCartCheckoutPayment,
      openOrderPayment,
      openSipMandate,
      closePayment,
    }),
    [activePayment, closePayment, openCartCheckoutPayment, openOrderPayment, openSipMandate],
  );

  return (
    <MfPaymentOverlayContext.Provider value={value}>
      {children}
      {activePayment?.kind === "cart-checkout" ? (
        <MfCartCheckoutPayView
          key={activePayment.checkoutId}
          checkoutId={activePayment.checkoutId}
          onClose={closePayment}
        />
      ) : null}
      {activePayment?.kind === "order" ? (
        <MfOrderPayView key={activePayment.orderId} orderId={activePayment.orderId} onClose={closePayment} />
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
