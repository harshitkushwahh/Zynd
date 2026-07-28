"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  abandonMfOrderPayment,
  fetchMfOrder,
  type MfOrder,
} from "@/features/invest/api/invest-api";
import { MfPayoutBankSummary } from "@/features/invest/components/mf-bank-account-picker";
import { MfPaymentJourneyDialog, MfPaymentCheckoutDetailsSkeleton, MfPaymentStatusBadges } from "@/features/invest/components/payment-dialog";
import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { formatInr } from "@/features/invest/lib/mf-format";
import {
  clearLastMfPaymentSession,
  clearMfPaymentRedirect,
  getLastMfPaymentOrderId,
  markMfPaymentRedirect,
  wasMfPaymentRedirected,
} from "@/features/invest/lib/mf-payment-session";
import { copy } from "@/shared/config/copy";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvestCacheInvalidation } from "@/features/invest/hooks/use-invest-cache-invalidation";

type MfOrderPayViewProps = {
  orderId: string;
  onClose?: () => void;
};

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);
const POLL_MS = 2000;
const RETURN_POLL_ATTEMPTS = 15;

function resolveOrderPayPhase(args: {
  loading: boolean;
  order: MfOrder | null;
  error: string | null;
  abandonChecked: boolean;
  returnedFromPayment: boolean;
}): MfPaymentJourneyPhase {
  const { loading, order, error, abandonChecked, returnedFromPayment } = args;

  if (!abandonChecked && returnedFromPayment) return "waiting";
  if ((loading && !order) || !abandonChecked) return "processing";
  if (error || !order) return "error";
  if (order.status === "SUCCEEDED") return "success";
  if (order.status === "FAILED" || order.status === "CANCELLED") return "error";
  return "waiting";
}

function resolveOrderPayMessage(args: {
  phase: MfPaymentJourneyPhase;
  order: MfOrder | null;
  error: string | null;
  redirecting: boolean;
  returnedFromPayment: boolean;
  abandonChecked: boolean;
}): string {
  const { phase, order, error, redirecting, returnedFromPayment, abandonChecked } = args;

  if (phase === "processing") return copy.mutualFunds.orderPayProcessing;
  if (phase === "error") {
    if (order?.failure_code === "payment_abandoned") return copy.mutualFunds.orderPayAbandoned;
    return error ?? order?.failure_reason ?? copy.mutualFunds.orderPayFailed;
  }
  if (phase === "success") return copy.mutualFunds.orderPaySuccess;
  if (redirecting) return copy.mutualFunds.orderPayRedirecting;
  if (returnedFromPayment && !abandonChecked) return copy.mutualFunds.orderPayReturnConfirming;
  if (order?.next_action === "wait_review" || order?.fp_state === "under_review") {
    return copy.mutualFunds.orderPayUnderReview;
  }
  if (order?.next_action === "wait_payment_setup" || order?.status === "PAYMENT_PENDING") {
    return copy.mutualFunds.orderPayPendingSetup;
  }
  return copy.mutualFunds.orderPayPolling;
}

export function MfOrderPayView({ orderId, onClose }: MfOrderPayViewProps) {
  const router = useRouter();
  const [order, setOrder] = useState<MfOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [abandonChecked, setAbandonChecked] = useState(() => !wasMfPaymentRedirected(orderId));
  const [returnRetryToken, setReturnRetryToken] = useState(0);
  const redirectedRef = useRef(false);
  const abandonedRef = useRef(false);
  const returnedFromPayment = wasMfPaymentRedirected(orderId);

  useInvestCacheInvalidation(`order-${orderId}`, order?.status === "SUCCEEDED");

  const loadOrder = useCallback(async () => {
    try {
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
      abandonedRef.current = false;
      setRedirecting(false);
      setAbandonChecked(false);
      setReturnRetryToken((token) => token + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [orderId]);

  useEffect(() => {
    if (abandonedRef.current || !wasMfPaymentRedirected(orderId)) {
      setAbandonChecked(true);
      return;
    }
    abandonedRef.current = true;
    void (async () => {
      try {
        const next = await abandonMfOrderPayment(orderId);
        setOrder(next);
        setError(null);
        clearMfPaymentRedirect(orderId);
      } catch {
        const next = await loadOrder();
        if (next && !TERMINAL_STATUSES.has(next.status)) {
          setError(copy.mutualFunds.orderPayAbandoned);
        }
      } finally {
        setLoading(false);
        setAbandonChecked(true);
        clearMfPaymentRedirect(orderId);
      }
    })();
  }, [loadOrder, orderId, returnRetryToken]);

  useEffect(() => {
    if (!abandonChecked) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const next = await loadOrder();
      if (cancelled || !next) return;
      if (!TERMINAL_STATUSES.has(next.status)) {
        timer = setTimeout(() => void poll(), POLL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [abandonChecked, loadOrder]);

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
    abandonChecked,
    returnedFromPayment,
  });
  const message = resolveOrderPayMessage({
    phase,
    order,
    error,
    redirecting,
    returnedFromPayment,
    abandonChecked,
  });
  const showOrderDetails = phase === "processing" || phase === "waiting";
  const statusDetail =
    order && showOrderDetails && abandonChecked ? (
      <MfPaymentStatusBadges status={order.status} fpState={order.fp_state} />
    ) : undefined;

  const subtitle =
    showOrderDetails
      ? order
        ? (
            <span className="block w-full text-pretty text-center">
              <span className="block font-medium text-foreground">
                {order.product_name ?? copy.mutualFunds.unknownFund}
              </span>
              <span className="mt-0.5 block text-caption text-muted-foreground">
                {formatInr(order.amount_inr)}
              </span>
            </span>
          )
        : <Skeleton className="mx-auto h-9 w-52 max-w-full" aria-hidden="true" />
      : undefined;

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

  function handleSecondaryAction() {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/dashboard/mutual-funds");
  }

  return (
    <MfPaymentJourneyDialog
      phase={phase}
      title={title}
      subtitle={subtitle}
      message={message}
      statusDetail={statusDetail}
      onDismiss={dismissPaymentDialog}
      primaryLabel={
        phase === "success" || phase === "error" ? copy.mutualFunds.backToBrowse : undefined
      }
      onPrimaryAction={
        phase === "success" || phase === "error" ? dismissPaymentDialog : undefined
      }
      secondaryLabel={showOrderDetails && order ? copy.mutualFunds.orderPayBackToFund : undefined}
      onSecondaryAction={showOrderDetails && order ? handleSecondaryAction : undefined}
    >
      {showOrderDetails ? (
        order ? (
          <MfPayoutBankSummary
            masked={order.payout_bank_account_masked}
            ifsc={order.payout_bank_ifsc_code}
            bankName={order.payout_bank_name}
          />
        ) : (
          <MfPaymentCheckoutDetailsSkeleton orderLines={0} />
        )
      ) : null}
    </MfPaymentJourneyDialog>
  );
}

export function MfOrderPaymentReturnView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<MfOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedRef = useRef(false);

  const orderId =
    searchParams.get("order_id") ??
    searchParams.get("orderId") ??
    getLastMfPaymentOrderId();

  useInvestCacheInvalidation(
    orderId ? `order-return-${orderId}` : "order-return-pending",
    order?.status === "SUCCEEDED",
  );

  useEffect(() => {
    if (!orderId || resolvedRef.current) return;
    resolvedRef.current = true;

    let cancelled = false;
    let attempts = 0;

    const resolve = async () => {
      try {
        const next = await fetchMfOrder(orderId);
        if (cancelled) return;
        setOrder(next);

        if (next.status === "SUCCEEDED") {
          clearLastMfPaymentSession();
          setLoading(false);
          return;
        }

        if (TERMINAL_STATUSES.has(next.status)) {
          setLoading(false);
          return;
        }

        attempts += 1;
        if (attempts < RETURN_POLL_ATTEMPTS) {
          setTimeout(() => void resolve(), POLL_MS);
          return;
        }

        const abandoned = await abandonMfOrderPayment(orderId);
        if (!cancelled) {
          setOrder(abandoned);
          clearLastMfPaymentSession();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : copy.mutualFunds.ordersLoadError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const phase: MfPaymentJourneyPhase = loading
    ? "waiting"
    : error
      ? "error"
      : order?.status === "SUCCEEDED"
        ? "success"
        : order?.status === "FAILED" || order?.status === "CANCELLED"
          ? "error"
          : !order
            ? "error"
            : "waiting";

  const message = loading
    ? copy.mutualFunds.orderPayReturnConfirming
    : phase === "success"
      ? copy.mutualFunds.orderPaySuccess
      : phase === "error"
        ? order?.failure_code === "payment_abandoned"
          ? copy.mutualFunds.orderPayAbandoned
          : error ?? order?.failure_reason ?? copy.mutualFunds.orderPayReturnUnknown
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
      title={title}
      message={message}
      primaryLabel={copy.mutualFunds.backToBrowse}
      onPrimaryAction={dismissReturnDialog}
      onDismiss={dismissReturnDialog}
    />
  );
}
