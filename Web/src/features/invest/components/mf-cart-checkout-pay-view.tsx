"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
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
  clearMfPaymentRedirect,
  getLastMfPaymentCheckoutId,
  markMfPaymentRedirect,
  wasMfPaymentRedirected,
} from "@/features/invest/lib/mf-payment-session";
import { copy } from "@/shared/config/copy";
import { useInvestCacheInvalidation } from "@/features/invest/hooks/use-invest-cache-invalidation";

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
  returnedFromPayment: boolean;
  returnConfirming: boolean;
  longRunning: boolean;
  paymentOutcome: MfPaymentReconcileOutcome | null;
}): string {
  const {
    phase,
    checkout,
    error,
    redirecting,
    returnedFromPayment,
    returnConfirming,
    longRunning,
    paymentOutcome,
  } = args;

  if (phase === "processing") return copy.mutualFunds.orderPayProcessing;
  if (phase === "error") {
    if (checkout?.failure_code === "payment_abandoned") return copy.mutualFunds.orderPayAbandoned;
    return error ?? checkout?.failure_reason ?? copy.mutualFunds.orderPayFailed;
  }
  if (phase === "success") return copy.mutualFunds.orderPaySuccess;
  if (redirecting) return copy.mutualFunds.orderPayRedirecting;
  if (returnConfirming || (returnedFromPayment && phase === "waiting")) {
    if (paymentOutcome === "unclear") return copy.mutualFunds.orderPayReturnUnclear;
    return longRunning
      ? copy.mutualFunds.orderPayReturnStillProcessing
      : copy.mutualFunds.orderPayReturnConfirming;
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
  const [checkout, setCheckout] = useState<MfCheckout | null>(null);
  const [paymentOutcome, setPaymentOutcome] = useState<MfPaymentReconcileOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [returnConfirming, setReturnConfirming] = useState(false);
  const [longRunning, setLongRunning] = useState(false);
  const [returnRetryToken, setReturnRetryToken] = useState(0);
  const redirectedRef = useRef(false);
  const pollAttemptsRef = useRef(0);
  const reconcilePollingRef = useRef(wasMfPaymentRedirected(checkoutId));
  const returnedFromPayment = wasMfPaymentRedirected(checkoutId);

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
    function handlePageShow() {
      if (!wasMfPaymentRedirected(checkoutId)) return;
      setRedirecting(false);
      setReturnRetryToken((token) => token + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [checkoutId]);

  useEffect(() => {
    if (!wasMfPaymentRedirected(checkoutId)) {
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
      clearMfPaymentRedirect(checkoutId);
      setReturnConfirming(false);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [checkoutId, loadCheckout, returnRetryToken]);

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
  }, [checkoutId, loadCheckout, returnConfirming, returnRetryToken]);

  useEffect(() => {
    if (!checkout?.payment_url || checkout.next_action !== "pay_upi") return;
    if (TERMINAL_STATUSES.has(checkout.status)) return;
    if (redirectedRef.current || wasMfPaymentRedirected(checkoutId)) return;

    redirectedRef.current = true;
    setRedirecting(true);
    markMfPaymentRedirect({ checkoutId });
    window.location.href = checkout.payment_url;
  }, [checkout, checkoutId]);

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
    returnedFromPayment,
    returnConfirming,
    longRunning,
    paymentOutcome,
  });
  const primaryOrder = checkout?.orders[0];
  const terminalLines = resolvePaymentTerminalLines({
    phase,
    abandonChecked: true,
    redirecting,
    returnedFromPayment,
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
      onDismiss={dismissPaymentDialog}
      primaryLabel={
        phase === "error"
          ? copy.mutualFunds.paymentJourneyBackToCart
          : phase === "success" || longRunning
            ? copy.mutualFunds.backToBrowse
            : undefined
      }
      onPrimaryAction={
        phase === "success" || phase === "error" || longRunning ? dismissPaymentDialog : undefined
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
