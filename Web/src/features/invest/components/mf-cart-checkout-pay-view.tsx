"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  abandonMfCheckoutPayment,
  fetchMfCheckout,
  type MfCheckout,
} from "@/features/invest/api/invest-api";
import { MfPayoutBankSummary } from "@/features/invest/components/mf-bank-account-picker";
import { MfPaymentJourneyDialog, MfPaymentCheckoutDetailsSkeleton, MfPaymentStatusBadges } from "@/features/invest/components/payment-dialog";
import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { formatInr } from "@/features/invest/lib/mf-format";
import {
  clearMfPaymentRedirect,
  markMfPaymentRedirect,
  wasMfPaymentRedirected,
} from "@/features/invest/lib/mf-payment-session";
import { copy } from "@/shared/config/copy";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvestCacheInvalidation } from "@/features/invest/hooks/use-invest-cache-invalidation";

type MfCartCheckoutPayViewProps = {
  checkoutId: string;
  onClose?: () => void;
};

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);
const POLL_MS = 2000;

function resolveCheckoutPhase(args: {
  loading: boolean;
  checkout: MfCheckout | null;
  error: string | null;
  abandonChecked: boolean;
  returnedFromPayment: boolean;
}): MfPaymentJourneyPhase {
  const { loading, checkout, error, abandonChecked, returnedFromPayment } = args;

  if (!abandonChecked && returnedFromPayment) return "waiting";
  if ((loading && !checkout) || !abandonChecked) return "processing";
  if (error || !checkout) return "error";
  if (checkout.status === "SUCCEEDED") return "success";
  if (checkout.status === "FAILED" || checkout.status === "CANCELLED") return "error";
  return "waiting";
}

function resolveCheckoutMessage(args: {
  phase: MfPaymentJourneyPhase;
  checkout: MfCheckout | null;
  error: string | null;
  redirecting: boolean;
  returnedFromPayment: boolean;
  abandonChecked: boolean;
}): string {
  const { phase, checkout, error, redirecting, returnedFromPayment, abandonChecked } = args;

  if (phase === "processing") return copy.mutualFunds.orderPayProcessing;
  if (phase === "error") {
    if (checkout?.failure_code === "payment_abandoned") return copy.mutualFunds.orderPayAbandoned;
    return error ?? checkout?.failure_reason ?? copy.mutualFunds.orderPayFailed;
  }
  if (phase === "success") return copy.mutualFunds.orderPaySuccess;
  if (redirecting) return copy.mutualFunds.orderPayRedirecting;
  if (returnedFromPayment && !abandonChecked) return copy.mutualFunds.orderPayReturnConfirming;
  return copy.mutualFunds.orderPayPolling;
}

export function MfCartCheckoutPayView({ checkoutId, onClose }: MfCartCheckoutPayViewProps) {
  const router = useRouter();
  const [checkout, setCheckout] = useState<MfCheckout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [abandonChecked, setAbandonChecked] = useState(() => !wasMfPaymentRedirected(checkoutId));
  const [returnRetryToken, setReturnRetryToken] = useState(0);
  const redirectedRef = useRef(false);
  const abandonedRef = useRef(false);
  const returnedFromPayment = wasMfPaymentRedirected(checkoutId);

  useInvestCacheInvalidation(
    `checkout-${checkoutId}`,
    checkout?.status === "SUCCEEDED",
  );

  const loadCheckout = useCallback(async () => {
    try {
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
      abandonedRef.current = false;
      setRedirecting(false);
      setAbandonChecked(false);
      setReturnRetryToken((token) => token + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [checkoutId]);

  useEffect(() => {
    if (abandonedRef.current || !wasMfPaymentRedirected(checkoutId)) {
      setAbandonChecked(true);
      return;
    }
    abandonedRef.current = true;
    void (async () => {
      try {
        const next = await abandonMfCheckoutPayment(checkoutId);
        setCheckout(next);
        setError(null);
        clearMfPaymentRedirect(checkoutId);
      } catch {
        const next = await loadCheckout();
        if (next && !TERMINAL_STATUSES.has(next.status)) {
          setError(copy.mutualFunds.orderPayAbandoned);
        }
      } finally {
        setLoading(false);
        setAbandonChecked(true);
        clearMfPaymentRedirect(checkoutId);
      }
    })();
  }, [checkoutId, loadCheckout, returnRetryToken]);

  useEffect(() => {
    if (!abandonChecked) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const next = await loadCheckout();
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
  }, [abandonChecked, loadCheckout]);

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
    abandonChecked,
    returnedFromPayment,
  });
  const message = resolveCheckoutMessage({
    phase,
    checkout,
    error,
    redirecting,
    returnedFromPayment,
    abandonChecked,
  });
  const showCheckoutDetails = phase === "processing" || phase === "waiting";
  const statusDetail =
    checkout && showCheckoutDetails && abandonChecked ? (
      <MfPaymentStatusBadges
        status={checkout.status}
        fpState={checkout.orders[0]?.fp_state}
      />
    ) : undefined;

  const subtitle =
    showCheckoutDetails
      ? checkout
        ? (
            <span className="block w-full text-pretty text-center">
              <span className="block font-medium text-foreground">
                {copy.mutualFunds.cartPayDescription.replace("{count}", String(checkout.orders.length))}
              </span>
              <span className="mt-0.5 block text-caption text-muted-foreground">
                {formatInr(checkout.total_amount_inr)}
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
        phase === "error"
          ? copy.mutualFunds.paymentJourneyBackToCart
          : phase === "success"
            ? copy.mutualFunds.backToBrowse
            : undefined
      }
      onPrimaryAction={
        phase === "success" || phase === "error" ? dismissPaymentDialog : undefined
      }
      secondaryLabel={showCheckoutDetails && checkout ? copy.mutualFunds.orderPayBackToFund : undefined}
      onSecondaryAction={showCheckoutDetails && checkout ? handleSecondaryAction : undefined}
    >
      {showCheckoutDetails ? (
        checkout ? (
          <>
            <MfPayoutBankSummary
              masked={checkout.payout_bank_account_masked}
              ifsc={checkout.payout_bank_ifsc_code}
              bankName={checkout.payout_bank_name}
            />

            <ul className="space-y-2 rounded-[var(--radius-card)] border border-border px-4 py-3">
              {checkout.orders.map((line) => (
                <li key={line.order_id} className="flex items-center justify-between gap-3 text-compact">
                  <span className="min-w-0 truncate text-foreground">
                    {line.product_name ?? copy.mutualFunds.unknownFund}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{formatInr(line.amount_inr)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <MfPaymentCheckoutDetailsSkeleton orderLines={1} />
        )
      ) : null}
    </MfPaymentJourneyDialog>
  );
}

export function MfCartPaymentReturnView() {
  const router = useRouter();

  return (
    <MfPaymentJourneyDialog
      phase="waiting"
      title={copy.mutualFunds.orderPayReturnTitle}
      message={copy.mutualFunds.orderPayReturnDescription}
      primaryLabel={copy.mutualFunds.backToBrowse}
      onPrimaryAction={() => router.push("/dashboard/mutual-funds")}
      onDismiss={() => router.push("/dashboard/mutual-funds")}
    />
  );
}
