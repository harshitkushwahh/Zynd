"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";

import {
  abandonMfSipMandate,
  confirmMfSipMandateReturn,
  fetchMfSipPlan,
  payMfSipFirstInstallment,
  type MfSipPlan,
} from "@/features/invest/api/invest-api";
import { MfPaymentJourneyDialog } from "@/features/invest/components/payment-dialog";
import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { resolveSipMandateTerminalLines } from "@/features/invest/lib/mf-sip-mandate-terminal-lines";
import { formatInr } from "@/features/invest/lib/mf-format";
import { resolveSipFailureReason } from "@/features/invest/lib/mf-sip-failure-copy";
import {
  clearMfSipFirstInstallmentRedirect,
  clearMfSipMandateRedirect,
  clearMfSipPaymentSession,
  getNextMfSipCartCheckoutPlanId,
  markMfSipFirstInstallmentAutoStarted,
  markMfSipFirstInstallmentRedirect,
  markMfSipMandateRedirect,
  removeMfSipCartCheckoutPlan,
  wasMfSipFirstInstallmentAutoStarted,
  wasMfSipFirstInstallmentRedirected,
  wasMfSipMandateRedirected,
  wasMfSipPaymentDismissed,
} from "@/features/invest/lib/mf-payment-session";
import { copy } from "@/shared/config/copy";
import { useInvestCacheInvalidation } from "@/features/invest/hooks/use-invest-cache-invalidation";
import { useMfPaymentOverlayOptional } from "@/features/invest/contexts/mf-payment-overlay-context";

const SIP_UNAVAILABLE_FAILURE_CODES = new Set(["scheme_not_available", "sip_not_allowed"]);

type MfSipMandateViewProps = {
  planId: string;
  onClose?: () => void;
};

const TERMINAL_STATUSES = new Set(["ACTIVE", "FAILED", "CANCELLED"]);
const POLL_MS = 2000;

function formatSipAmount(plan: MfSipPlan | null): string {
  if (!plan) return "";
  return formatInr(plan.amount_inr);
}

function withSipAmount(template: string, plan: MfSipPlan | null): string {
  return template.replaceAll("{amount}", formatSipAmount(plan));
}

function withFirstInstallmentAmount(template: string, plan: MfSipPlan | null): string {
  if (!plan) return template;
  const amount = plan.first_installment?.amount_inr ?? plan.amount_inr;
  return template.replaceAll("{amount}", formatInr(amount));
}

function mandateAlreadyApproved(plan: MfSipPlan | null): boolean {
  if (!plan?.mandate) return false;
  return plan.mandate.status?.toUpperCase() === "APPROVED";
}

function resolveMandateAuthUrl(plan: MfSipPlan): string | null {
  const authUrl = plan.mandate_auth_url ?? plan.mandate?.auth_url;
  return authUrl?.trim() || null;
}

function isBankSwitchFlow(plan: MfSipPlan | null): boolean {
  if (!plan) return false;
  return (
    plan.next_action === "authorize_mandate_switch" ||
    plan.next_action === "wait_bank_switch" ||
    Boolean(plan.bank_switch?.in_progress)
  );
}

function isBankSwitchComplete(plan: MfSipPlan | null): boolean {
  return Boolean(plan?.bank_switch?.used && !plan.bank_switch.in_progress);
}

function isFirstInstallmentPending(plan: MfSipPlan | null): boolean {
  if (!plan || plan.status !== "ACTIVE") return false;
  return plan.next_action === "pay_first_installment" || plan.first_installment?.status === "pending";
}

function isSipSetupComplete(plan: MfSipPlan | null): boolean {
  if (!plan || plan.status !== "ACTIVE") return false;
  if (isBankSwitchFlow(plan) && !isBankSwitchComplete(plan)) return false;
  return !isFirstInstallmentPending(plan);
}

function attemptMandateAuthRedirect(args: {
  plan: MfSipPlan;
  planId: string;
  redirectedRef: MutableRefObject<boolean>;
}): boolean {
  const authUrl = resolveMandateAuthUrl(args.plan);
  const shouldRedirect =
    args.plan.next_action === "authorize_mandate" ||
    args.plan.next_action === "authorize_mandate_switch";
  if (!authUrl || !shouldRedirect) return false;
  if (TERMINAL_STATUSES.has(args.plan.status) && !isBankSwitchFlow(args.plan)) return false;
  if (args.redirectedRef.current || wasMfSipMandateRedirected(args.planId)) return false;

  args.redirectedRef.current = true;
  markMfSipMandateRedirect(args.planId);
  window.location.replace(authUrl);
  return true;
}

function resolveSipMandatePhase(args: {
  loading: boolean;
  plan: MfSipPlan | null;
  error: string | null;
  abandonChecked: boolean;
  returnedFromMandate: boolean;
  returnedFromFirstInstallment: boolean;
  returnConfirming: boolean;
  redirectingToFirstInstallment: boolean;
}): MfPaymentJourneyPhase {
  const {
    loading,
    plan,
    error,
    abandonChecked,
    returnedFromMandate,
    returnedFromFirstInstallment,
    returnConfirming,
    redirectingToFirstInstallment,
  } = args;

  if (returnConfirming || redirectingToFirstInstallment) return "waiting";
  if (!abandonChecked && (returnedFromMandate || returnedFromFirstInstallment)) return "waiting";
  if ((loading && !plan) || !abandonChecked) return "processing";
  if (error || !plan) return "error";
  if (isSipSetupComplete(plan)) return "success";
  if (plan.status === "ACTIVE") return "waiting";
  if (plan.status === "FAILED" || plan.status === "CANCELLED") return "error";
  return "waiting";
}

function resolveSipMandateMessage(args: {
  phase: MfPaymentJourneyPhase;
  plan: MfSipPlan | null;
  error: string | null;
  returnedFromMandate: boolean;
  returnedFromFirstInstallment: boolean;
  firstInstallmentRetryOffered: boolean;
  abandonChecked: boolean;
  redirectingToFirstInstallment: boolean;
  returnConfirming: boolean;
}): string {
  const {
    phase,
    plan,
    error,
    returnedFromMandate,
    firstInstallmentRetryOffered,
    abandonChecked,
    redirectingToFirstInstallment,
    returnConfirming,
  } = args;

  if (redirectingToFirstInstallment) return copy.mutualFunds.sipFirstInstallmentRedirecting;
  if (returnConfirming) {
    return withFirstInstallmentAmount(copy.mutualFunds.sipFirstInstallmentReady, plan);
  }
  if (firstInstallmentRetryOffered && isFirstInstallmentPending(plan)) {
    return copy.mutualFunds.sipFirstInstallmentRetry;
  }
  if (phase === "processing") {
    if (mandateAlreadyApproved(plan)) {
      return withSipAmount(copy.mutualFunds.sipMandateActivating, plan);
    }
    return copy.mutualFunds.sipProcessing;
  }
  if (phase === "error") {
    const trimmedError = error?.trim();
    if (trimmedError) return trimmedError;
    if (plan?.status === "CANCELLED") return copy.mutualFunds.sipMandateAbandoned;
    const friendlyFailure = resolveSipFailureReason(plan);
    if (friendlyFailure) return friendlyFailure;
    return copy.mutualFunds.sipJourneyFailedMessage;
  }
  if (phase === "success") {
    return isBankSwitchComplete(plan)
      ? copy.mySips.bankSwitch.success
      : copy.mutualFunds.sipSuccess;
  }
  if (isFirstInstallmentPending(plan)) {
    return withFirstInstallmentAmount(copy.mutualFunds.sipFirstInstallmentReady, plan);
  }
  if (returnedFromMandate && !abandonChecked) return copy.mutualFunds.sipReturnDescription;
  if (plan?.next_action === "authorize_mandate" || plan?.next_action === "authorize_mandate_switch") {
    return withSipAmount(copy.mutualFunds.sipMandateReady, plan);
  }
  if (plan?.next_action === "wait_bank_switch") {
    return copy.mySips.bankSwitch.inProgressBadge;
  }
  if (mandateAlreadyApproved(plan)) {
    return withSipAmount(copy.mutualFunds.sipMandateActivating, plan);
  }
  return copy.mutualFunds.sipReturnDescription;
}

function shouldAbandonIncompleteMandate(plan: MfSipPlan | null, returnedFromMandate: boolean) {
  if (!plan || returnedFromMandate) return false;
  if (TERMINAL_STATUSES.has(plan.status)) return false;
  if (isBankSwitchFlow(plan)) return false;
  if (plan.next_action === "authorize_mandate" || plan.next_action === "wait_mandate") return true;
  return plan.mandate?.status?.toUpperCase() !== "APPROVED";
}

function resolveSipMandateStatusDetail(plan: MfSipPlan | null): string | undefined {
  if (!plan) return undefined;
  if (plan.status === "FAILED" || plan.status === "CANCELLED") return undefined;
  if (isFirstInstallmentPending(plan)) return undefined;
  if (plan.status === "ACTIVE") return undefined;
  if (mandateAlreadyApproved(plan) && plan.next_action !== "authorize_mandate_switch") {
    return copy.mutualFunds.sipMandateReuseNote;
  }
  if (plan.next_action === "authorize_mandate" || plan.next_action === "authorize_mandate_switch") {
    return withSipAmount(copy.mutualFunds.sipMandateAutopayNote, plan);
  }
  if (plan.next_action === "wait_bank_switch") {
    return copy.mySips.bankSwitch.dialogDescription;
  }
  return undefined;
}

export function MfSipMandateView({ planId, onClose }: MfSipMandateViewProps) {
  const router = useRouter();
  const paymentOverlay = useMfPaymentOverlayOptional();
  const [plan, setPlan] = useState<MfSipPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abandonChecked, setAbandonChecked] = useState(
    () => !wasMfSipMandateRedirected(planId) && !wasMfSipFirstInstallmentRedirected(planId),
  );
  const [returnConfirming, setReturnConfirming] = useState(false);
  const [redirectingToFirstInstallment, setRedirectingToFirstInstallment] = useState(false);
  const [firstInstallmentRetryOffered, setFirstInstallmentRetryOffered] = useState(false);
  const [returnRetryToken, setReturnRetryToken] = useState(0);
  const redirectedRef = useRef(false);
  const mandateReturnConfirmRef = useRef(false);
  const cartChainRef = useRef(false);
  const dismissedRef = useRef(false);
  const returnedFromMandate = wasMfSipMandateRedirected(planId);

  useInvestCacheInvalidation(`sip-mandate-${planId}`, isSipSetupComplete(plan));
  useInvestCacheInvalidation(
    `sip-bank-switch-${planId}`,
    Boolean(plan?.bank_switch?.used && !plan.bank_switch.in_progress),
  );
  useInvestCacheInvalidation(
    `sip-mandate-block-${planId}`,
    plan?.status === "FAILED" &&
      Boolean(plan.failure_code && SIP_UNAVAILABLE_FAILURE_CODES.has(plan.failure_code)),
  );

  const loadPlan = useCallback(async () => {
    try {
      const next = await fetchMfSipPlan(planId);
      if (next) {
        attemptMandateAuthRedirect({ plan: next, planId, redirectedRef });
      }
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

  const startFirstInstallmentPayment = useCallback(
    async (options?: { auto?: boolean }) => {
      if (!plan || !isFirstInstallmentPending(plan)) return null;
      try {
        setRedirectingToFirstInstallment(Boolean(options?.auto));
        const payment = await payMfSipFirstInstallment(planId);
        const updatedPlan: MfSipPlan = {
          ...plan,
          payment_url: payment.payment_url,
          first_installment: payment,
          next_action: "pay_first_installment",
        };
        setPlan(updatedPlan);
        setError(null);

        if (payment.payment_url) {
          redirectedRef.current = true;
          markMfSipFirstInstallmentRedirect(planId);
          window.location.replace(payment.payment_url);
        } else {
          setRedirectingToFirstInstallment(false);
        }
        return updatedPlan;
      } catch (err) {
        setRedirectingToFirstInstallment(false);
        setFirstInstallmentRetryOffered(true);
        markMfSipFirstInstallmentAutoStarted(planId);
        const message = err instanceof Error ? err.message : copy.mutualFunds.sipLoadError;
        if (message.toLowerCase().includes("already in progress")) {
          setError(copy.mutualFunds.sipFirstInstallmentInProgress);
        } else {
          setError(message);
        }
        return null;
      }
    },
    [plan, planId],
  );

  useEffect(() => {
    const pendingReturn =
      wasMfSipMandateRedirected(planId) || wasMfSipFirstInstallmentRedirected(planId);
    if (wasMfSipPaymentDismissed(planId) && !pendingReturn) {
      dismissedRef.current = true;
      onClose?.();
    }
  }, [onClose, planId]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (dismissedRef.current || wasMfSipPaymentDismissed(planId)) return;
      const pendingMandate = wasMfSipMandateRedirected(planId);
      const pendingFirst = wasMfSipFirstInstallmentRedirected(planId);
      if (!pendingMandate && !pendingFirst) return;
      if (!event.persisted) return;
      mandateReturnConfirmRef.current = false;
      setRedirectingToFirstInstallment(false);
      setAbandonChecked(false);
      setReturnRetryToken((token) => token + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [planId]);

  useEffect(() => {
    if (wasMfSipFirstInstallmentRedirected(planId)) {
      let cancelled = false;
      setReturnConfirming(true);

      void (async () => {
        try {
          const next = await fetchMfSipPlan(planId);
          if (!cancelled && next) {
            setPlan(next);
            if (isFirstInstallmentPending(next)) {
              setFirstInstallmentRetryOffered(true);
            }
          }
          setError(null);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : copy.mutualFunds.sipLoadError);
          }
        } finally {
          if (!cancelled) {
            clearMfSipFirstInstallmentRedirect(planId);
            setReturnConfirming(false);
            setLoading(false);
            setAbandonChecked(true);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    if (!wasMfSipMandateRedirected(planId)) {
      setAbandonChecked(true);
      return;
    }
    if (mandateReturnConfirmRef.current) return;
    mandateReturnConfirmRef.current = true;

    void (async () => {
      try {
        let next = await fetchMfSipPlan(planId);
        const needsMandateConfirm =
          next &&
          !TERMINAL_STATUSES.has(next.status) &&
          next.next_action !== "pay_first_installment" &&
          next.first_installment?.status !== "pending";
        if (needsMandateConfirm) {
          next = await confirmMfSipMandateReturn(planId);
        }
        setPlan(next);
        setError(null);
      } catch {
        const next = await loadPlan();
        if (next) setPlan(next);
      } finally {
        clearMfSipMandateRedirect(planId);
        setLoading(false);
        setAbandonChecked(true);
      }
    })();
  }, [loadPlan, planId, returnRetryToken]);

  useEffect(() => {
    if (!abandonChecked || returnConfirming || dismissedRef.current) return;
    if (!plan || !isFirstInstallmentPending(plan)) return;
    if (firstInstallmentRetryOffered || wasMfSipFirstInstallmentAutoStarted(planId)) return;
    if (redirectedRef.current) return;

    markMfSipFirstInstallmentAutoStarted(planId);
    void startFirstInstallmentPayment({ auto: true });
  }, [
    abandonChecked,
    firstInstallmentRetryOffered,
    plan,
    planId,
    returnConfirming,
    startFirstInstallmentPayment,
  ]);

  useEffect(() => {
    if (!isSipSetupComplete(plan)) return;
    if (cartChainRef.current) return;

    const nextPlanId = getNextMfSipCartCheckoutPlanId(planId);
    removeMfSipCartCheckoutPlan(planId);
    if (!nextPlanId) return;

    cartChainRef.current = true;
    paymentOverlay?.openSipMandate(nextPlanId);
  }, [paymentOverlay, plan, planId]);

  useEffect(() => {
    if (!abandonChecked || dismissedRef.current) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const next = await loadPlan();
      if (cancelled || !next || dismissedRef.current) return;
      if (isSipSetupComplete(next)) return;
      const bankSwitchPending = isBankSwitchFlow(next) && !isBankSwitchComplete(next);
      const firstInstallmentPending = isFirstInstallmentPending(next);
      const setupPending = !TERMINAL_STATUSES.has(next.status) || firstInstallmentPending;
      if (setupPending || bankSwitchPending) {
        timer = setTimeout(() => void poll(), POLL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [abandonChecked, loadPlan]);

  useEffect(() => {
    if (!plan) return;
    attemptMandateAuthRedirect({ plan, planId, redirectedRef });
  }, [plan, planId]);

  const returnedFromFirstInstallment =
    firstInstallmentRetryOffered || wasMfSipFirstInstallmentRedirected(planId);

  const phase = resolveSipMandatePhase({
    loading,
    plan,
    error,
    abandonChecked,
    returnedFromMandate,
    returnedFromFirstInstallment,
    returnConfirming,
    redirectingToFirstInstallment,
  });
  const message = resolveSipMandateMessage({
    phase,
    plan,
    error,
    returnedFromMandate,
    returnedFromFirstInstallment,
    firstInstallmentRetryOffered,
    abandonChecked,
    redirectingToFirstInstallment,
    returnConfirming,
  });
  const terminalLines = resolveSipMandateTerminalLines({
    phase,
    abandonChecked,
    returnedFromMandate,
    nextAction: plan?.next_action,
    status: plan?.status,
  });
  const isInProgress = phase === "processing" || phase === "waiting";
  const firstInstallmentDue =
    isFirstInstallmentPending(plan) &&
    !redirectingToFirstInstallment &&
    !returnConfirming &&
    (firstInstallmentRetryOffered || wasMfSipFirstInstallmentAutoStarted(planId));
  const firstInstallmentPending = isFirstInstallmentPending(plan);
  const useTerminalLayout =
    isInProgress &&
    !firstInstallmentPending &&
    !firstInstallmentDue &&
    !firstInstallmentRetryOffered &&
    !redirectingToFirstInstallment;

  const title =
    phase === "error"
      ? copy.mutualFunds.sipJourneyFailedTitle
      : phase === "success"
        ? copy.mutualFunds.sipJourneySuccessTitle
        : copy.mutualFunds.sipMandateTitle;

  function dismissMandateDialog() {
    dismissedRef.current = true;
    clearMfSipPaymentSession(planId);

    if (shouldAbandonIncompleteMandate(plan, returnedFromMandate)) {
      void abandonMfSipMandate(planId).finally(() => {
        removeMfSipCartCheckoutPlan(planId);
      });
    }

    if (onClose) {
      onClose();
      return;
    }
    router.push("/dashboard/mutual-funds");
  }

  return (
    <MfPaymentJourneyDialog
      phase={phase}
      layout={useTerminalLayout ? "terminal" : "default"}
      allowDismiss={
        firstInstallmentPending ||
        firstInstallmentDue ||
        firstInstallmentRetryOffered ||
        redirectingToFirstInstallment ||
        phase === "success" ||
        phase === "error"
      }
      title={title}
      subtitle={
        !useTerminalLayout && !isInProgress && plan
          ? copy.mutualFunds.sipMandateAmountSubtitle.replace("{amount}", formatSipAmount(plan))
          : undefined
      }
      message={message}
      statusDetail={!useTerminalLayout && !isInProgress ? resolveSipMandateStatusDetail(plan) : undefined}
      terminalLines={terminalLines}
      onDismiss={dismissMandateDialog}
      primaryLabel={
        firstInstallmentDue
          ? copy.mutualFunds.sipFirstInstallmentCta
          : phase === "success" || phase === "error"
            ? copy.mutualFunds.backToBrowse
            : undefined
      }
      onPrimaryAction={
        firstInstallmentDue
          ? () => void startFirstInstallmentPayment()
          : phase === "success" || phase === "error"
            ? dismissMandateDialog
            : undefined
      }
    />
  );
}
