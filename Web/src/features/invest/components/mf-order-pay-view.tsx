"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
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
import { resolvePaymentTerminalLines } from "@/features/invest/lib/mf-payment-terminal-lines";
import {
  MF_PAYMENT_POLL_MS,
  MF_PAYMENT_RETURN_FAST_ATTEMPTS,
} from "@/features/invest/lib/mf-payment-poll";
import {
  clearLastMfPaymentSession,
  clearMfPaymentRedirect,
  getLastMfPaymentOrderId,
  markMfPaymentRedirect,
  wasMfPaymentRedirected,
} from "@/features/invest/lib/mf-payment-session";
import { copy } from "@/shared/config/copy";
import { useInvestCacheInvalidation } from "@/features/invest/hooks/use-invest-cache-invalidation";

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
  if (paymentOutcome === "success" || order.status === "SUCCEEDED") return "success";
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
  returnedFromPayment: boolean;
  returnConfirming: boolean;
  longRunning: boolean;
  paymentOutcome: MfPaymentReconcileOutcome | null;
}): string {
  const {
    phase,
    order,
    error,
    redirecting,
    returnedFromPayment,
    returnConfirming,
    longRunning,
    paymentOutcome,
  } = args;

  if (phase === "processing") return copy.mutualFunds.orderPayProcessing;
  if (phase === "error") {
    if (order?.failure_code === "payment_abandoned") return copy.mutualFunds.orderPayAbandoned;
    return error ?? order?.failure_reason ?? copy.mutualFunds.orderPayFailed;
  }
  if (phase === "success") return copy.mutualFunds.orderPaySuccess;
  if (redirecting) return copy.mutualFunds.orderPayRedirecting;
  if (returnConfirming || (returnedFromPayment && phase === "waiting")) {
    if (paymentOutcome === "unclear") return copy.mutualFunds.orderPayReturnUnclear;
    return longRunning
      ? copy.mutualFunds.orderPayReturnStillProcessing
      : copy.mutualFunds.orderPayReturnConfirming;
  }
  if (order?.next_action === "wait_review" || order?.fp_state === "under_review") {
    return copy.mutualFunds.orderPayUnderReview;
  }
  if (order?.next_action === "wait_payment_setup" || order?.status === "PAYMENT_PENDING") {
    return copy.mutualFunds.orderPayPendingSetup;
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
  const [order, setOrder] = useState<MfOrder | null>(null);
  const [paymentOutcome, setPaymentOutcome] = useState<MfPaymentReconcileOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [returnConfirming, setReturnConfirming] = useState(false);
  const [longRunning, setLongRunning] = useState(false);
  const [returnRetryToken, setReturnRetryToken] = useState(0);
  const redirectedRef = useRef(false);
  const pollAttemptsRef = useRef(0);
  const reconcilePollingRef = useRef(wasMfPaymentRedirected(orderId));
  const returnedFromPayment = wasMfPaymentRedirected(orderId);

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
    function handlePageShow() {
      if (!wasMfPaymentRedirected(orderId)) return;
      setRedirecting(false);
      setReturnRetryToken((token) => token + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [orderId]);

  useEffect(() => {
    if (!wasMfPaymentRedirected(orderId)) {
      void loadOrder();
      return;
    }

    let cancelled = false;
    reconcilePollingRef.current = true;
    setReturnConfirming(true);
    setLongRunning(false);
    pollAttemptsRef.current = 0;

    void (async () => {
      const status = await syncOrderPaymentReturn(orderId);
      if (cancelled) return;
      setPaymentOutcome(status.outcome);
      const next = pickOrderFromPaymentStatus(status);
      if (next) setOrder(next);
      clearMfPaymentRedirect(orderId);
      setReturnConfirming(false);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadOrder, orderId, returnRetryToken]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
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
          if (cancelled) return;
          setPaymentOutcome(status.outcome);
          const next = pickOrderFromPaymentStatus(status);
          if (next) setOrder(next);
          if (isMfPaymentReconcileTerminal(status.outcome)) return;
          timer = setTimeout(() => void poll(), MF_PAYMENT_POLL_MS);
          return;
        } catch {
          // Fall through to plain order fetch.
        }
      }

      const next = await loadOrder();
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
  }, [loadOrder, orderId, returnConfirming, returnRetryToken]);

  useEffect(() => {
    if (!order?.payment_url || order.next_action !== "pay_upi") return;
    if (TERMINAL_STATUSES.has(order.status)) return;
    if (redirectedRef.current || wasMfPaymentRedirected(orderId)) return;

    redirectedRef.current = true;
    setRedirecting(true);
    markMfPaymentRedirect({ orderId });
    window.location.href = order.payment_url;
  }, [order, orderId]);

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
    returnedFromPayment,
    returnConfirming,
    longRunning,
    paymentOutcome,
  });
  const terminalLines = resolvePaymentTerminalLines({
    phase,
    abandonChecked: true,
    redirecting,
    returnedFromPayment,
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
      onDismiss={dismissPaymentDialog}
      primaryLabel={
        phase === "success" || phase === "error" || longRunning
          ? copy.mutualFunds.backToBrowse
          : undefined
      }
      onPrimaryAction={
        phase === "success" || phase === "error" || longRunning
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
        : paymentOutcome === "success" || order?.status === "SUCCEEDED"
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
            ? copy.mutualFunds.orderPayAbandoned
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
