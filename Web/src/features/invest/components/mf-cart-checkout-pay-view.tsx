"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  abandonMfCheckoutPayment,
  fetchMfCheckout,
  type MfCheckout,
  type MfPaymentReconcileOutcome,
} from "@/features/invest/api/invest-api";
import { MfPaymentJourneyDialog } from "@/features/invest/components/payment-dialog";
import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import {
  isMfPaymentReconcileTerminal,
  pickCheckoutFromPaymentStatus,
  reconcileMfCheckoutPayment,
} from "@/features/invest/lib/mf-lumpsum-payment-reconcile";
import { resolvePaymentTerminalLines } from "@/features/invest/lib/mf-payment-terminal-lines";
import {
  MF_PAYMENT_POLL_MS,
  MF_PAYMENT_RETURN_FAST_ATTEMPTS,
} from "@/features/invest/lib/mf-payment-poll";
import {
  clearLastMfPaymentSession,
  clearMfLumpsumPaymentDismissed,
  clearMfLumpsumPaymentSession,
  clearMfPaymentRedirect,
  getLastMfPaymentCheckoutId,
  getMfPaymentGatewayMode,
  isMfPaymentFullPageGatewayReturn,
  markMfLumpsumPaymentDismissed,
  markMfPaymentRedirect,
  wasMfPaymentRedirected,
} from "@/features/invest/lib/mf-payment-session";
import { copy } from "@/shared/config/copy";
import { useInvestCacheInvalidation } from "@/features/invest/hooks/use-invest-cache-invalidation";
import { useMfPaymentGatewayPopup } from "@/features/invest/hooks/use-mf-payment-gateway-popup";
import { launchMfPaymentGatewayUrl } from "@/features/invest/lib/mf-payment-gateway-popup";
import { isFreshInvestOrder } from "@/features/invest/lib/mf-payment-order-age";

type MfCartCheckoutPayViewProps = {
  checkoutId: string;
  onClose?: () => void;
};

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

function resolveCheckoutPhase(args: {
  loading: boolean;
  checkout: MfCheckout | null;
  error: string | null;
  returnedFromPayment: boolean;
  returnConfirming: boolean;
  paymentOutcome: MfPaymentReconcileOutcome | null;
}): MfPaymentJourneyPhase {
  const { loading, checkout, error, returnedFromPayment, returnConfirming, paymentOutcome } = args;

  if (returnConfirming || (returnedFromPayment && loading && !checkout)) return "waiting";
  if (loading && !checkout) return "processing";
  if (error || !checkout) return "error";
  if (paymentOutcome === "success" || checkout.status === "SUCCEEDED") return "success";
  if (paymentOutcome === "failed") return "error";
  if (paymentOutcome === "pending" || paymentOutcome === "unclear") return "waiting";
  if (checkout.status === "FAILED" || checkout.status === "CANCELLED") return "error";
  return "waiting";
}

function resolveCheckoutMessage(args: {
  phase: MfPaymentJourneyPhase;
  checkout: MfCheckout | null;
  error: string | null;
  redirecting: boolean;
  gatewayPopupOpen: boolean;
  returnedFromPayment: boolean;
  returnConfirming: boolean;
  gatewayReturnHandled: boolean;
  longRunning: boolean;
  paymentOutcome: MfPaymentReconcileOutcome | null;
}): string {
  const {
    phase,
    checkout,
    error,
    redirecting,
    gatewayPopupOpen,
    returnedFromPayment,
    returnConfirming,
    gatewayReturnHandled,
    longRunning,
    paymentOutcome,
  } = args;

  if (gatewayPopupOpen) return copy.mutualFunds.paymentGatewayPopupHint;
  if (phase === "processing") return copy.mutualFunds.orderPayProcessing;
  if (phase === "error") {
    if (checkout?.failure_code === "payment_abandoned") {
      if (isFreshInvestOrder(checkout.created_at) && !returnedFromPayment) {
        return checkout.failure_reason ?? copy.mutualFunds.orderPayFailed;
      }
      return copy.mutualFunds.orderPayAbandoned;
    }
    return error ?? checkout?.failure_reason ?? copy.mutualFunds.orderPayFailed;
  }
  if (phase === "success") return copy.mutualFunds.orderPaySuccess;
  if (redirecting) return copy.mutualFunds.orderPayRedirecting;
  if (returnConfirming || (returnedFromPayment && phase === "waiting" && !gatewayReturnHandled)) {
    if (paymentOutcome === "unclear") return copy.mutualFunds.orderPayReturnUnclear;
    return longRunning
      ? copy.mutualFunds.orderPayReturnStillProcessing
      : copy.mutualFunds.orderPayReturnConfirming;
  }
  if (
    returnedFromPayment &&
    gatewayReturnHandled &&
    phase === "waiting" &&
    (paymentOutcome === "failed" ||
      checkout?.status === "CANCELLED" ||
      checkout?.status === "FAILED" ||
      checkout?.failure_code === "payment_abandoned")
  ) {
    return copy.mutualFunds.orderPayAbandoned;
  }
  const primaryOrder = checkout?.orders[0];
  if (
    checkout?.next_action === "wait_processing" ||
    primaryOrder?.next_action === "wait_processing" ||
    (checkout?.status === "PENDING" && !returnedFromPayment)
  ) {
    return copy.mutualFunds.orderPayProcessing;
  }
  if (
    checkout?.next_action === "wait_payment_setup" ||
    checkout?.status === "PAYMENT_PENDING" ||
    primaryOrder?.next_action === "wait_payment_setup" ||
    primaryOrder?.status === "PAYMENT_PENDING"
  ) {
    return copy.mutualFunds.orderPayPendingSetup;
  }
  return copy.mutualFunds.orderPayPolling;
}

async function syncCheckoutPaymentReturn(checkoutId: string) {
  try {
    return await reconcileMfCheckoutPayment(checkoutId);
  } catch {
    const checkout = await fetchMfCheckout(checkoutId);
    return { outcome: "pending" as const, checkout };
  }
}

export function MfCartCheckoutPayView({ checkoutId, onClose }: MfCartCheckoutPayViewProps) {
  const router = useRouter();
  const initialGatewayReturn = isMfPaymentFullPageGatewayReturn(checkoutId);
  const [checkout, setCheckout] = useState<MfCheckout | null>(null);
  const [paymentOutcome, setPaymentOutcome] = useState<MfPaymentReconcileOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [returnConfirming, setReturnConfirming] = useState(false);
  const [longRunning, setLongRunning] = useState(false);
  const [returnRetryToken, setReturnRetryToken] = useState(0);
  const [returnedFromGateway, setReturnedFromGateway] = useState(initialGatewayReturn);
  const [gatewayReturnHandled, setGatewayReturnHandled] = useState(!initialGatewayReturn);
  const [gatewayPopupOpen, setGatewayPopupOpen] = useState(false);
  const redirectedRef = useRef(false);
  const pollAttemptsRef = useRef(0);
  const reconcilePollingRef = useRef(true);
  const returnedFromPayment = returnedFromGateway;

  const signalGatewayReturn = useCallback(() => {
    setGatewayPopupOpen(false);
    setReturnedFromGateway(true);
    setRedirecting(false);
    setGatewayReturnHandled(false);
    setReturnRetryToken((token) => token + 1);
  }, []);

  const handlePopupClosedWithoutReturn = useCallback(() => {
    if (!wasMfPaymentRedirected(checkoutId)) return;
    void (async () => {
      setGatewayPopupOpen(false);
      setReturnConfirming(true);
      try {
        const next = await abandonMfCheckoutPayment(checkoutId);
        setCheckout(next);
        setPaymentOutcome("failed");
        setError(null);
      } catch (err) {
        setPaymentOutcome("failed");
        setError(err instanceof Error ? err.message : copy.mutualFunds.orderPayFailed);
      } finally {
        setReturnedFromGateway(true);
        setGatewayReturnHandled(true);
        setReturnConfirming(false);
        setLoading(false);
        clearMfPaymentRedirect(checkoutId);
      }
    })();
  }, [checkoutId]);

  const { attachPopup } = useMfPaymentGatewayPopup({
    checkoutId,
    onGatewayReturn: signalGatewayReturn,
    onPopupClosedWithoutReturn: handlePopupClosedWithoutReturn,
  });

  const goToPaymentUrl = useCallback(
    (paymentUrl: string) => {
      setRedirecting(true);
      setError(null);
      const { popup, result } = launchMfPaymentGatewayUrl(paymentUrl);
      if (result === "same_tab") {
        markMfPaymentRedirect({ checkoutId, mode: "full_page" });
        return;
      }
      if (result === "popup" && popup) {
        markMfPaymentRedirect({ checkoutId, mode: "popup" });
        attachPopup(popup);
        setGatewayPopupOpen(true);
        setRedirecting(false);
        return;
      }
      setRedirecting(false);
      setError(copy.mutualFunds.paymentGatewayPopupBlocked);
    },
    [attachPopup, checkoutId],
  );

  useInvestCacheInvalidation(`checkout-${checkoutId}`, checkout?.status === "SUCCEEDED");

  const loadCheckout = useCallback(async () => {
    try {
      if (reconcilePollingRef.current) {
        const status = await reconcileMfCheckoutPayment(checkoutId);
        setPaymentOutcome(status.outcome);
        const next = pickCheckoutFromPaymentStatus(status);
        if (next) setCheckout(next);
        setError(null);
        return next;
      }

      const next = await fetchMfCheckout(checkoutId);
      setCheckout(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.cartCheckoutLoadError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [checkoutId]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (getMfPaymentGatewayMode(checkoutId) === "popup") return;
      if (!wasMfPaymentRedirected(checkoutId)) return;
      setReturnedFromGateway(true);
      setRedirecting(false);
      if (event.persisted) {
        setGatewayReturnHandled(false);
      }
      setReturnRetryToken((token) => token + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [checkoutId]);

  useEffect(() => {
    if (!returnedFromGateway) {
      void loadCheckout();
      return;
    }

    let cancelled = false;
    reconcilePollingRef.current = true;
    setReturnConfirming(true);
    setLongRunning(false);
    pollAttemptsRef.current = 0;

    void (async () => {
      const status = await syncCheckoutPaymentReturn(checkoutId);
      if (cancelled) return;
      setPaymentOutcome(status.outcome);
      const next = pickCheckoutFromPaymentStatus(status);
      if (next) setCheckout(next);
      setReturnConfirming(false);
      setGatewayReturnHandled(true);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [checkoutId, loadCheckout, returnRetryToken, returnedFromGateway]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (gatewayPopupOpen) {
        timer = setTimeout(() => void poll(), MF_PAYMENT_POLL_MS);
        return;
      }
      if (returnConfirming) {
        timer = setTimeout(() => void poll(), MF_PAYMENT_POLL_MS);
        return;
      }

      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current > MF_PAYMENT_RETURN_FAST_ATTEMPTS) {
        setLongRunning(true);
      }

      if (reconcilePollingRef.current) {
        try {
          const status = await reconcileMfCheckoutPayment(checkoutId);
          if (cancelled) return;
          setPaymentOutcome(status.outcome);
          const next = pickCheckoutFromPaymentStatus(status);
          if (next) setCheckout(next);
          if (isMfPaymentReconcileTerminal(status.outcome)) return;
          timer = setTimeout(() => void poll(), MF_PAYMENT_POLL_MS);
          return;
        } catch {
          // Fall through to plain checkout fetch.
        }
      }

      const next = await loadCheckout();
      if (cancelled || !next) return;
      if (!TERMINAL_STATUSES.has(next.status)) {
        timer = setTimeout(() => void poll(), MF_PAYMENT_POLL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [checkoutId, gatewayPopupOpen, loadCheckout, returnConfirming, returnRetryToken]);

  useEffect(() => {
    if (!gatewayReturnHandled || returnedFromGateway) return;
    if (!checkout?.payment_url || checkout.next_action !== "pay_upi") return;
    if (TERMINAL_STATUSES.has(checkout.status)) return;
    if (redirectedRef.current || wasMfPaymentRedirected(checkoutId)) return;

    redirectedRef.current = true;
    goToPaymentUrl(checkout.payment_url);
    if (!wasMfPaymentRedirected(checkoutId)) {
      redirectedRef.current = false;
    }
  }, [checkout, checkoutId, gatewayReturnHandled, goToPaymentUrl, returnedFromGateway]);

  const canRetryPayment =
    returnedFromGateway &&
    gatewayReturnHandled &&
    !redirecting &&
    !returnConfirming &&
    Boolean(checkout?.payment_url) &&
    checkout?.next_action === "pay_upi" &&
    !TERMINAL_STATUSES.has(checkout?.status ?? "");

  const canLeaveAfterReturn =
    returnedFromGateway &&
    gatewayReturnHandled &&
    !redirecting &&
    !returnConfirming;

  function handleManualPayment() {
    if (!checkout?.payment_url) return;
    clearMfPaymentRedirect(checkoutId);
    clearMfLumpsumPaymentDismissed(checkoutId);
    redirectedRef.current = false;
    setReturnedFromGateway(false);
    setGatewayPopupOpen(false);
    setGatewayReturnHandled(true);
    goToPaymentUrl(checkout.payment_url);
  }

  const phase = resolveCheckoutPhase({
    loading,
    checkout,
    error,
    returnedFromPayment,
    returnConfirming,
    paymentOutcome,
  });
  const message = resolveCheckoutMessage({
    phase,
    checkout,
    error,
    redirecting,
    gatewayPopupOpen,
    returnedFromPayment,
    returnConfirming,
    gatewayReturnHandled,
    longRunning,
    paymentOutcome,
  });
  const primaryOrder = checkout?.orders[0];
  const terminalLines = resolvePaymentTerminalLines({
    phase,
    abandonChecked: true,
    redirecting,
    gatewayPopupOpen,
    returnedFromPayment: returnedFromPayment && !gatewayPopupOpen,
    nextAction: checkout?.next_action ?? primaryOrder?.next_action,
    fpState: primaryOrder?.fp_state,
    status: checkout?.status,
  });
  const isInProgress = phase === "processing" || phase === "waiting";

  const title =
    phase === "error"
      ? copy.mutualFunds.paymentJourneyFailedTitle
      : phase === "success"
        ? copy.mutualFunds.paymentJourneySuccessTitle
        : copy.mutualFunds.cartPayTitle;

  function dismissPaymentDialog() {
    if (paymentOutcome === "success" || checkout?.status === "SUCCEEDED") {
      clearLastMfPaymentSession();
    } else if (
      checkout &&
      !TERMINAL_STATUSES.has(checkout.status) &&
      returnedFromPayment &&
      gatewayReturnHandled
    ) {
      markMfLumpsumPaymentDismissed(checkoutId);
      void abandonMfCheckoutPayment(checkoutId);
    }
    clearMfLumpsumPaymentSession(checkoutId);
    if (onClose) {
      onClose();
      return;
    }
    if (phase === "error") {
      router.push("/dashboard/mutual-funds/cart");
      return;
    }
    router.push("/dashboard/mutual-funds");
  }

  return (
    <MfPaymentJourneyDialog
      phase={phase}
      layout={isInProgress ? "terminal" : "default"}
      title={title}
      message={message}
      terminalLines={terminalLines}
      allowDismiss={canLeaveAfterReturn || phase === "success" || phase === "error" || longRunning}
      onDismiss={dismissPaymentDialog}
      primaryLabel={
        canRetryPayment
          ? copy.mutualFunds.orderPayUpiCta
          : phase === "error"
            ? copy.mutualFunds.paymentJourneyBackToCart
            : canLeaveAfterReturn || phase === "success" || longRunning
              ? copy.mutualFunds.backToBrowse
              : undefined
      }
      onPrimaryAction={
        canRetryPayment
          ? handleManualPayment
          : canLeaveAfterReturn || phase === "success" || phase === "error" || longRunning
            ? dismissPaymentDialog
            : undefined
      }
    />
  );
}

export function MfCartPaymentReturnView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [checkout, setCheckout] = useState<MfCheckout | null>(null);
  const [paymentOutcome, setPaymentOutcome] = useState<MfPaymentReconcileOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [longRunning, setLongRunning] = useState(false);
  const pollAttemptsRef = useRef(0);

  const checkoutId =
    searchParams.get("checkout_id") ??
    searchParams.get("checkoutId") ??
    getLastMfPaymentCheckoutId();

  useInvestCacheInvalidation(
    checkoutId ? `checkout-return-${checkoutId}` : "checkout-return-pending",
    checkout?.status === "SUCCEEDED",
  );

  useEffect(() => {
    if (!checkoutId) {
      setLoading(false);
      setError(copy.mutualFunds.orderPayReturnUnknown);
      return;
    }

    let cancelled = false;
    pollAttemptsRef.current = 0;
    setLongRunning(false);

    const poll = async () => {
      try {
        const status = await reconcileMfCheckoutPayment(checkoutId);
        const next = pickCheckoutFromPaymentStatus(status);
        if (cancelled) return;

        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current > MF_PAYMENT_RETURN_FAST_ATTEMPTS) {
          setLongRunning(true);
        }

        setPaymentOutcome(status.outcome);
        if (next) setCheckout(next);
        setError(null);

        if (status.outcome === "success" || next?.status === "SUCCEEDED") {
          clearLastMfPaymentSession();
          setLoading(false);
          return;
        }

        if (isMfPaymentReconcileTerminal(status.outcome)) {
          setLoading(false);
          return;
        }

        if (next && TERMINAL_STATUSES.has(next.status) && status.outcome === "failed") {
          setLoading(false);
          return;
        }

        setTimeout(() => void poll(), MF_PAYMENT_POLL_MS);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : copy.mutualFunds.cartCheckoutLoadError);
          setLoading(false);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [checkoutId]);

  const phase: MfPaymentJourneyPhase = !checkoutId
    ? "error"
    : loading && !longRunning
      ? "waiting"
      : error
        ? "error"
        : paymentOutcome === "success" || checkout?.status === "SUCCEEDED"
          ? "success"
          : paymentOutcome === "failed"
            ? "error"
            : paymentOutcome === "pending" || paymentOutcome === "unclear"
              ? "waiting"
              : checkout?.status === "FAILED" || checkout?.status === "CANCELLED"
                ? "error"
                : !checkout
                  ? "error"
                  : "waiting";

  const message = !checkoutId
    ? copy.mutualFunds.orderPayReturnUnknown
    : loading && !longRunning
      ? copy.mutualFunds.orderPayReturnConfirming
      : phase === "success"
        ? copy.mutualFunds.orderPaySuccess
        : phase === "error"
          ? checkout?.failure_code === "payment_abandoned"
            ? copy.mutualFunds.orderPayAbandoned
            : error ?? checkout?.failure_reason ?? copy.mutualFunds.orderPayReturnUnknown
          : paymentOutcome === "unclear"
            ? copy.mutualFunds.orderPayReturnUnclear
            : longRunning
              ? copy.mutualFunds.orderPayReturnStillProcessing
              : copy.mutualFunds.orderPayReturnDescription;

  const title =
    phase === "error"
      ? copy.mutualFunds.paymentJourneyFailedTitle
      : phase === "success"
        ? copy.mutualFunds.paymentJourneySuccessTitle
        : copy.mutualFunds.orderPayReturnTitle;

  function dismissReturnDialog() {
    router.push("/dashboard/mutual-funds");
  }

  return (
    <MfPaymentJourneyDialog
      phase={phase}
      layout={phase === "waiting" ? "terminal" : "default"}
      title={title}
      message={message}
      terminalLines={resolvePaymentTerminalLines({
        phase,
        abandonChecked: true,
        redirecting: false,
        returnedFromPayment: true,
        status: checkout?.status,
      })}
      primaryLabel={
        phase === "success" || phase === "error" || longRunning
          ? copy.mutualFunds.backToBrowse
          : undefined
      }
      onPrimaryAction={
        phase === "success" || phase === "error" || longRunning
          ? dismissReturnDialog
          : undefined
      }
      onDismiss={dismissReturnDialog}
    />
  );
}
