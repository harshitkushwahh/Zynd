"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  abandonMfOrderPayment,
  fetchMfOrder,
  type MfOrder,
  type MfPaymentReconcileOutcome,
} from "@/features/invest/api/invest-api";
import { MfPaymentJourneyDialog } from "@/features/invest/components/payment-dialog";
import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import {
  isMfPaymentReconcileTerminal,
  pickOrderFromPaymentStatus,
  reconcileMfOrderPayment,
} from "@/features/invest/lib/mf-lumpsum-payment-reconcile";
import { isOrderPaymentCompleted } from "@/features/invest/lib/mf-order-payment-status";
import { resolvePaymentTerminalLines } from "@/features/invest/lib/mf-payment-terminal-lines";
import {
  MF_PAYMENT_POLL_MS,
  MF_PAYMENT_RETURN_FAST_ATTEMPTS,
} from "@/features/invest/lib/mf-payment-poll";
import {
  getGatewayReturnKind,
  isHistoryBackForwardNavigation,
  isHistoryGatewayReturn,
  shouldAbandonPaymentOnDismiss,
  shouldShowGatewayBackNotCompleted,
} from "@/features/invest/lib/mf-payment-gateway-return";
import {
  clearLastMfPaymentSession,
  clearMfLumpsumPaymentDismissed,
  clearMfLumpsumPaymentSession,
  clearMfPaymentRedirect,
  getLastMfPaymentOrderId,
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

type MfOrderPayViewProps = {
  orderId: string;
  onClose?: () => void;
};

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

function resolveOrderPayPhase(args: {
  loading: boolean;
  order: MfOrder | null;
  error: string | null;
  returnedFromPayment: boolean;
  returnConfirming: boolean;
  paymentOutcome: MfPaymentReconcileOutcome | null;
}): MfPaymentJourneyPhase {
  const { loading, order, error, returnedFromPayment, returnConfirming, paymentOutcome } = args;

  if (returnConfirming || (returnedFromPayment && loading && !order)) return "waiting";
  if (loading && !order) return "processing";
  if (error || !order) return "error";
  if (
    paymentOutcome === "success" ||
    order.status === "SUCCEEDED" ||
    isOrderPaymentCompleted(order)
  ) {
    return "success";
  }
  const setupStillRunning =
    !returnedFromPayment &&
    !order.payment_url &&
    order.failure_code === "payment_not_completed" &&
    isFreshInvestOrder(order.created_at);
  if (setupStillRunning) return "waiting";
  if (paymentOutcome === "failed") return "error";
  if (paymentOutcome === "pending" || paymentOutcome === "unclear") return "waiting";
  if (order.status === "FAILED" || order.status === "CANCELLED") return "error";
  return "waiting";
}

function resolveOrderPayMessage(args: {
  phase: MfPaymentJourneyPhase;
  order: MfOrder | null;
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
    order,
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
    if (order?.failure_code === "payment_abandoned") {
      if (returnedFromPayment) {
        return order.failure_reason?.trim() || error || copy.mutualFunds.orderPayNotCompleted;
      }
      if (isFreshInvestOrder(order.created_at)) {
        return order.failure_reason ?? copy.mutualFunds.orderPayFailed;
      }
      return copy.mutualFunds.orderPayAbandoned;
    }
    if (returnedFromPayment && (order?.failure_code === "payment_not_completed" || error)) {
      return order?.failure_reason?.trim() || error || copy.mutualFunds.orderPayNotCompleted;
    }
    return error ?? order?.failure_reason ?? copy.mutualFunds.orderPayFailed;
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
      order?.status === "CANCELLED" ||
      order?.status === "FAILED" ||
      order?.failure_code === "payment_abandoned")
  ) {
    return order?.failure_reason?.trim() || copy.mutualFunds.orderPayNotCompleted;
  }
  if (order?.next_action === "wait_review" || order?.fp_state === "under_review") {
    return copy.mutualFunds.orderPayProcessing;
  }
  if (order?.next_action === "wait_payment_setup" || order?.status === "PAYMENT_PENDING") {
    return copy.mutualFunds.orderPayPendingSetup;
  }
  if (
    order?.next_action === "wait_processing" ||
    (order?.status === "PENDING" && !returnedFromPayment)
  ) {
    return copy.mutualFunds.orderPayProcessing;
  }
  return copy.mutualFunds.orderPayPolling;
}

async function syncOrderPaymentReturn(orderId: string) {
  try {
    return await reconcileMfOrderPayment(orderId);
  } catch {
    const order = await fetchMfOrder(orderId);
    return { outcome: "pending" as const, order };
  }
}

export function MfOrderPayView({ orderId, onClose }: MfOrderPayViewProps) {
  const router = useRouter();
  const initialGatewayReturn = isMfPaymentFullPageGatewayReturn(orderId);
  const [order, setOrder] = useState<MfOrder | null>(null);
  const [paymentOutcome, setPaymentOutcome] = useState<MfPaymentReconcileOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [returnConfirming, setReturnConfirming] = useState(false);
  const [longRunning, setLongRunning] = useState(false);
  const [returnRetryToken, setReturnRetryToken] = useState(0);
  const [returnedFromGateway, setReturnedFromGateway] = useState(initialGatewayReturn);
  const [historyGatewayReturn, setHistoryGatewayReturn] = useState(
    () =>
      initialGatewayReturn &&
      (isHistoryBackForwardNavigation() || getGatewayReturnKind() === "history"),
  );
  const [gatewayReturnHandled, setGatewayReturnHandled] = useState(!initialGatewayReturn);
  const [gatewayPopupOpen, setGatewayPopupOpen] = useState(false);
  const redirectedRef = useRef(false);
  const pollAttemptsRef = useRef(0);
  const reconcilePollingRef = useRef(true);
  const concludedBackRef = useRef(false);
  const returnedFromPayment = returnedFromGateway;

  const signalGatewayReturn = useCallback(() => {
    setGatewayPopupOpen(false);
    setReturnedFromGateway(true);
    setRedirecting(false);
    setGatewayReturnHandled(false);
    setReturnRetryToken((token) => token + 1);
  }, []);

  const handlePopupClosedWithoutReturn = useCallback(() => {
    if (!wasMfPaymentRedirected(orderId)) return;
    void (async () => {
      setGatewayPopupOpen(false);
      setReturnConfirming(true);
      try {
        const next = await abandonMfOrderPayment(orderId);
        setOrder(next);
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
        clearMfPaymentRedirect(orderId);
      }
    })();
  }, [orderId]);

  const { attachPopup } = useMfPaymentGatewayPopup({
    orderId,
    onGatewayReturn: signalGatewayReturn,
    onPopupClosedWithoutReturn: handlePopupClosedWithoutReturn,
  });

  const goToPaymentUrl = useCallback(
    (paymentUrl: string) => {
      setRedirecting(true);
      setError(null);
      const { popup, result } = launchMfPaymentGatewayUrl(paymentUrl);
      if (result === "same_tab") {
        markMfPaymentRedirect({ orderId, mode: "full_page" });
        return;
      }
      if (result === "popup" && popup) {
        markMfPaymentRedirect({ orderId, mode: "popup" });
        attachPopup(popup);
        setGatewayPopupOpen(true);
        setRedirecting(false);
        return;
      }
      setRedirecting(false);
      setError(copy.mutualFunds.paymentGatewayPopupBlocked);
    },
    [attachPopup, orderId],
  );

  useInvestCacheInvalidation(`order-${orderId}`, order?.status === "SUCCEEDED");

  const loadOrder = useCallback(async () => {
    try {
      if (reconcilePollingRef.current) {
        const status = await reconcileMfOrderPayment(orderId);
        setPaymentOutcome(status.outcome);
        const next = pickOrderFromPaymentStatus(status);
        if (next) setOrder(next);
        setError(null);
        return next;
      }

      const next = await fetchMfOrder(orderId);
      setOrder(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.ordersLoadError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (getMfPaymentGatewayMode(orderId) === "popup") return;
      if (!wasMfPaymentRedirected(orderId)) return;
      setReturnedFromGateway(true);
      setRedirecting(false);
      setGatewayReturnHandled(false);
      if (isHistoryGatewayReturn(event) || getGatewayReturnKind() === "history") {
        setHistoryGatewayReturn(true);
      }
      setReturnRetryToken((token) => token + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [orderId]);

  useEffect(() => {
    if (!returnedFromGateway) {
      void loadOrder();
      return;
    }

    let cancelled = false;
    reconcilePollingRef.current = true;
    setReturnConfirming(true);
    setLongRunning(false);
    pollAttemptsRef.current = 0;
    concludedBackRef.current = false;

    void (async () => {
      const status = await syncOrderPaymentReturn(orderId);
      if (cancelled || concludedBackRef.current) return;
      setPaymentOutcome(status.outcome);
      const next = pickOrderFromPaymentStatus(status);
      if (next) setOrder(next);
      setReturnConfirming(false);
      setGatewayReturnHandled(true);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadOrder, orderId, returnRetryToken, returnedFromGateway]);

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
          const status = await reconcileMfOrderPayment(orderId);
          if (cancelled || concludedBackRef.current) return;
          const next = pickOrderFromPaymentStatus(status);
          if (
            shouldShowGatewayBackNotCompleted({
              historyReturn: historyGatewayReturn,
              attempts: pollAttemptsRef.current,
              outcome: status.outcome,
            })
          ) {
            concludedBackRef.current = true;
            reconcilePollingRef.current = false;
            try {
              const abandoned = await abandonMfOrderPayment(orderId);
              if (cancelled) return;
              setOrder(abandoned);
              const paid =
                abandoned.status === "SUCCEEDED" || isOrderPaymentCompleted(abandoned);
              setPaymentOutcome(paid ? "success" : "failed");
              if (!paid) {
                setError(abandoned.failure_reason?.trim() || copy.mutualFunds.orderPayNotCompleted);
              } else {
                setError(null);
              }
            } catch {
              if (cancelled) return;
              try {
                const latest = await reconcileMfOrderPayment(orderId);
                if (cancelled) return;
                const recovered = pickOrderFromPaymentStatus(latest);
                if (recovered) setOrder(recovered);
                const paid =
                  latest.outcome === "success" ||
                  (recovered != null && isOrderPaymentCompleted(recovered));
                setPaymentOutcome(paid ? "success" : "failed");
                setError(
                  paid
                    ? null
                    : recovered?.failure_reason?.trim() || copy.mutualFunds.orderPayNotCompleted,
                );
              } catch {
                if (!cancelled) {
                  setPaymentOutcome("failed");
                  setError(copy.mutualFunds.orderPayNotCompleted);
                }
              }
            } finally {
              if (!cancelled) {
                setReturnConfirming(false);
                setGatewayReturnHandled(true);
                setLoading(false);
              }
            }
            return;
          }
          setPaymentOutcome(status.outcome);
          if (next) setOrder(next);
          if (isMfPaymentReconcileTerminal(status.outcome)) return;
          if (next && isOrderPaymentCompleted(next)) return;
          timer = setTimeout(() => void poll(), MF_PAYMENT_POLL_MS);
          return;
        } catch {
          // Fall through to plain order fetch.
        }
      }

      const next = await loadOrder();
      if (cancelled || !next) return;
      if (!TERMINAL_STATUSES.has(next.status) && !isOrderPaymentCompleted(next)) {
        timer = setTimeout(() => void poll(), MF_PAYMENT_POLL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [gatewayPopupOpen, historyGatewayReturn, loadOrder, orderId, returnConfirming, returnRetryToken]);

  useEffect(() => {
    if (!gatewayReturnHandled || returnedFromGateway) return;
    if (!order?.payment_url) return;
    if (TERMINAL_STATUSES.has(order.status)) return;
    if (redirectedRef.current || wasMfPaymentRedirected(orderId)) return;

    redirectedRef.current = true;
    goToPaymentUrl(order.payment_url);
    if (!wasMfPaymentRedirected(orderId)) {
      redirectedRef.current = false;
    }
  }, [gatewayReturnHandled, goToPaymentUrl, order, orderId, returnedFromGateway]);

  const canRetryPayment =
    returnedFromGateway &&
    gatewayReturnHandled &&
    !redirecting &&
    !returnConfirming &&
    Boolean(order?.payment_url) &&
    !TERMINAL_STATUSES.has(order?.status ?? "");

  const paymentStarted = wasMfPaymentRedirected(orderId) || Boolean(order?.payment_url);
  const canLeaveAfterReturn =
    returnedFromGateway &&
    gatewayReturnHandled &&
    !redirecting &&
    !returnConfirming;

  function handleManualPayment() {
    if (!order?.payment_url) return;
    clearMfPaymentRedirect(orderId);
    clearMfLumpsumPaymentDismissed(orderId);
    redirectedRef.current = false;
    setReturnedFromGateway(false);
    setGatewayPopupOpen(false);
    setGatewayReturnHandled(true);
    goToPaymentUrl(order.payment_url);
  }

  const phase = resolveOrderPayPhase({
    loading,
    order,
    error,
    returnedFromPayment,
    returnConfirming,
    paymentOutcome,
  });
  const message = resolveOrderPayMessage({
    phase,
    order,
    error,
    redirecting,
    gatewayPopupOpen,
    returnedFromPayment,
    returnConfirming,
    gatewayReturnHandled,
    longRunning,
    paymentOutcome,
  });
  const terminalLines = resolvePaymentTerminalLines({
    phase,
    abandonChecked: true,
    redirecting,
    gatewayPopupOpen,
    returnedFromPayment: returnedFromPayment && !gatewayPopupOpen,
    nextAction: order?.next_action,
    fpState: order?.fp_state,
    status: order?.status,
  });
  const isInProgress = phase === "processing" || phase === "waiting";

  const title =
    phase === "error"
      ? copy.mutualFunds.paymentJourneyFailedTitle
      : phase === "success"
        ? copy.mutualFunds.paymentJourneySuccessTitle
        : copy.mutualFunds.orderPayTitle;

  function dismissPaymentDialog() {
    if (
      paymentOutcome === "success" ||
      order?.status === "SUCCEEDED" ||
      (order && isOrderPaymentCompleted(order))
    ) {
      clearLastMfPaymentSession();
    } else if (
      order &&
      shouldAbandonPaymentOnDismiss({
        isTerminal: TERMINAL_STATUSES.has(order.status),
        paymentSucceeded: isOrderPaymentCompleted(order),
        paymentStarted,
      })
    ) {
      markMfLumpsumPaymentDismissed(orderId);
      void abandonMfOrderPayment(orderId);
    }
    clearMfLumpsumPaymentSession(orderId);
    if (onClose) {
      onClose();
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
      allowDismiss={
        canLeaveAfterReturn ||
        paymentStarted ||
        phase === "success" ||
        phase === "error" ||
        longRunning
      }
      onDismiss={dismissPaymentDialog}
      primaryLabel={
        canRetryPayment
          ? copy.mutualFunds.orderPayUpiCta
          : canLeaveAfterReturn ||
              paymentStarted ||
              phase === "success" ||
              phase === "error" ||
              longRunning
            ? copy.mutualFunds.backToBrowse
            : undefined
      }
      onPrimaryAction={
        canRetryPayment
          ? handleManualPayment
          : canLeaveAfterReturn ||
              paymentStarted ||
              phase === "success" ||
              phase === "error" ||
              longRunning
            ? dismissPaymentDialog
            : undefined
      }
    />
  );
}

export function MfOrderPaymentReturnView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<MfOrder | null>(null);
  const [paymentOutcome, setPaymentOutcome] = useState<MfPaymentReconcileOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [longRunning, setLongRunning] = useState(false);
  const pollAttemptsRef = useRef(0);

  const orderId =
    searchParams.get("order_id") ??
    searchParams.get("orderId") ??
    getLastMfPaymentOrderId();

  useInvestCacheInvalidation(
    orderId ? `order-return-${orderId}` : "order-return-pending",
    order?.status === "SUCCEEDED",
  );

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError(copy.mutualFunds.orderPayReturnUnknown);
      return;
    }

    let cancelled = false;
    pollAttemptsRef.current = 0;
    setLongRunning(false);

    const poll = async () => {
      try {
        const status = await reconcileMfOrderPayment(orderId);
        const next = pickOrderFromPaymentStatus(status);
        if (cancelled) return;

        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current > MF_PAYMENT_RETURN_FAST_ATTEMPTS) {
          setLongRunning(true);
        }

        setPaymentOutcome(status.outcome);
        if (next) setOrder(next);
        setError(null);

        if (
          status.outcome === "success" ||
          next?.status === "SUCCEEDED" ||
          (next && isOrderPaymentCompleted(next))
        ) {
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
          setError(err instanceof Error ? err.message : copy.mutualFunds.ordersLoadError);
          setLoading(false);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const phase: MfPaymentJourneyPhase = !orderId
    ? "error"
    : loading && !longRunning
      ? "waiting"
      : error
        ? "error"
        : paymentOutcome === "success" ||
            order?.status === "SUCCEEDED" ||
            (order && isOrderPaymentCompleted(order))
          ? "success"
          : paymentOutcome === "failed"
            ? "error"
            : paymentOutcome === "pending" || paymentOutcome === "unclear"
              ? "waiting"
              : order?.status === "FAILED" || order?.status === "CANCELLED"
                ? "error"
                : !order
                  ? "error"
                  : "waiting";

  const message = !orderId
    ? copy.mutualFunds.orderPayReturnUnknown
    : loading && !longRunning
      ? copy.mutualFunds.orderPayReturnConfirming
      : phase === "success"
        ? copy.mutualFunds.orderPaySuccess
        : phase === "error"
          ? order?.failure_code === "payment_abandoned"
          ? order?.failure_reason?.trim() || copy.mutualFunds.orderPayNotCompleted
            : error ?? order?.failure_reason ?? copy.mutualFunds.orderPayReturnUnknown
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
        status: order?.status,
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
