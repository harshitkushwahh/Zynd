"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cancelMfSipPlan, fetchMfSipPlan, type MfSipPlan } from "@/features/invest/api/invest-api";
import { MfPaymentJourneyDialog, MfPaymentStatusBadges } from "@/features/invest/components/payment-dialog";
import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { formatInr } from "@/features/invest/lib/mf-format";
import {
  clearMfPaymentRedirect,
  clearMfSipCartCheckoutPlans,
  getMfSipCartCheckoutPlanIds,
  markMfPaymentRedirect,
  wasMfPaymentRedirected,
} from "@/features/invest/lib/mf-payment-session";
import { copy } from "@/shared/config/copy";
import { useInvestCacheInvalidation } from "@/features/invest/hooks/use-invest-cache-invalidation";

type MfSipMandateViewProps = {
  planId: string;
  onClose?: () => void;
};

const TERMINAL_STATUSES = new Set(["ACTIVE", "FAILED", "CANCELLED"]);
const POLL_MS = 2000;

function resolveSipMandatePhase(args: {
  loading: boolean;
  plan: MfSipPlan | null;
  error: string | null;
  abandonChecked: boolean;
  returnedFromMandate: boolean;
}): MfPaymentJourneyPhase {
  const { loading, plan, error, abandonChecked, returnedFromMandate } = args;

  if (!abandonChecked && returnedFromMandate) return "waiting";
  if ((loading && !plan) || !abandonChecked) return "processing";
  if (error || !plan) return "error";
  if (plan.status === "ACTIVE") return "success";
  if (plan.status === "FAILED" || plan.status === "CANCELLED") return "error";
  return "waiting";
}

function resolveSipMandateMessage(args: {
  phase: MfPaymentJourneyPhase;
  plan: MfSipPlan | null;
  error: string | null;
  redirecting: boolean;
  returnedFromMandate: boolean;
  abandonChecked: boolean;
}): string {
  const { phase, plan, error, redirecting, returnedFromMandate, abandonChecked } = args;

  if (phase === "processing") return copy.mutualFunds.sipProcessing;
  if (phase === "error") {
    const trimmedError = error?.trim();
    if (trimmedError) return trimmedError;
    if (plan?.status === "CANCELLED") return copy.mutualFunds.sipMandateAbandoned;
    const trimmedReason = plan?.failure_reason?.trim();
    if (trimmedReason) return trimmedReason;
    return copy.mutualFunds.sipJourneyFailedMessage;
  }
  if (phase === "success") return copy.mutualFunds.sipSuccess;
  if (redirecting) return copy.mutualFunds.sipMandateRedirecting;
  if (returnedFromMandate && !abandonChecked) return copy.mutualFunds.orderPayReturnConfirming;
  if (plan?.next_action === "authorize_mandate") return copy.mutualFunds.sipMandateReady;
  return copy.mutualFunds.sipReturnDescription;
}

export function MfSipMandateView({ planId, onClose }: MfSipMandateViewProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<MfSipPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [abandonChecked, setAbandonChecked] = useState(() => !wasMfPaymentRedirected(planId));
  const [returnRetryToken, setReturnRetryToken] = useState(0);
  const redirectedRef = useRef(false);
  const abandonedRef = useRef(false);
  const returnedFromMandate = wasMfPaymentRedirected(planId);

  useInvestCacheInvalidation(`sip-mandate-${planId}`, plan?.status === "ACTIVE");

  const loadPlan = useCallback(async () => {
    try {
      const next = await fetchMfSipPlan(planId);
      setPlan(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.sipLoadError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    function handlePageShow() {
      if (!wasMfPaymentRedirected(planId)) return;
      abandonedRef.current = false;
      setRedirecting(false);
      setAbandonChecked(false);
      setReturnRetryToken((token) => token + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [planId]);

  useEffect(() => {
    if (abandonedRef.current || !wasMfPaymentRedirected(planId)) {
      setAbandonChecked(true);
      return;
    }
    abandonedRef.current = true;
    void (async () => {
      try {
        const batchPlanIds = getMfSipCartCheckoutPlanIds();
        const targets = batchPlanIds.length > 0 ? batchPlanIds : [planId];
        for (const id of targets) {
          await cancelMfSipPlan(id);
        }
        const next = await loadPlan();
        if (next) setPlan(next);
        setError(null);
        clearMfPaymentRedirect(planId);
      } catch {
        const next = await loadPlan();
        if (next && !TERMINAL_STATUSES.has(next.status)) {
          setError(copy.mutualFunds.sipMandateAbandoned);
        }
      } finally {
        setRedirecting(false);
        setLoading(false);
        setAbandonChecked(true);
        clearMfPaymentRedirect(planId);
        clearMfSipCartCheckoutPlans();
      }
    })();
  }, [loadPlan, planId, returnRetryToken]);

  useEffect(() => {
    if (!abandonChecked) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const next = await loadPlan();
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
  }, [abandonChecked, loadPlan]);

  const authUrl = plan?.mandate_auth_url ?? plan?.mandate?.auth_url;

  useEffect(() => {
    if (!authUrl || plan?.next_action !== "authorize_mandate") return;
    if (TERMINAL_STATUSES.has(plan.status)) return;
    if (redirectedRef.current || wasMfPaymentRedirected(planId)) return;

    redirectedRef.current = true;
    setRedirecting(true);
    markMfPaymentRedirect({ planId });
    window.location.href = authUrl;
  }, [authUrl, plan, planId]);

  const phase = resolveSipMandatePhase({
    loading,
    plan,
    error,
    abandonChecked,
    returnedFromMandate,
  });
  const showPlanDetails = phase === "processing" || phase === "waiting";
  const message = resolveSipMandateMessage({
    phase,
    plan,
    error,
    redirecting,
    returnedFromMandate,
    abandonChecked,
  });
  const statusDetail =
    plan && showPlanDetails && abandonChecked ? (
      <MfPaymentStatusBadges status={plan.status} fpState={plan.fp_state} />
    ) : undefined;

  const subtitle =
    showPlanDetails && plan
      ? (
          <span className="block w-full text-pretty text-center">
            <span className="block font-medium text-foreground">
              {plan.product_name ?? copy.mutualFunds.unknownFund}
            </span>
            <span className="mt-0.5 block text-caption text-muted-foreground">
              {formatInr(plan.amount_inr)} / {plan.frequency}
            </span>
          </span>
        )
      : undefined;

  const title =
    phase === "error"
      ? copy.mutualFunds.sipJourneyFailedTitle
      : phase === "success"
        ? copy.mutualFunds.sipJourneySuccessTitle
        : copy.mutualFunds.sipMandateTitle;

  function dismissMandateDialog() {
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
      onDismiss={dismissMandateDialog}
      primaryLabel={
        phase === "success" || phase === "error" ? copy.mutualFunds.backToBrowse : undefined
      }
      onPrimaryAction={
        phase === "success" || phase === "error" ? dismissMandateDialog : undefined
      }
      secondaryLabel={showPlanDetails && plan && abandonChecked ? copy.mutualFunds.orderPayBackToFund : undefined}
      onSecondaryAction={showPlanDetails && plan && abandonChecked ? handleSecondaryAction : undefined}
    />
  );
}

export function MfSipMandateReturnView() {
  const router = useRouter();

  return (
    <MfPaymentJourneyDialog
      phase="waiting"
      title={copy.mutualFunds.sipReturnTitle}
      message={copy.mutualFunds.sipReturnDescription}
      primaryLabel={copy.mutualFunds.backToBrowse}
      onPrimaryAction={() => router.push("/dashboard/mutual-funds")}
      onDismiss={() => router.push("/dashboard/mutual-funds")}
    />
  );
}
