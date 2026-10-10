"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";

import {
  abandonMfSipMandate,
  authMfMandate,
  confirmMfSipFirstInstallmentReturn,
  confirmMfSipMandateReturn,
  fetchMfSipPlan,
  payMfSipFirstInstallment,
  type MfSipPlan,
} from "@/features/invest/api/invest-api";
import { MfPaymentJourneyDialog } from "@/features/invest/components/payment-dialog";
import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { resolveSipMandateTerminalLines } from "@/features/invest/lib/mf-sip-mandate-terminal-lines";
import {
  getGatewayReturnKind,
  isHistoryBackForwardNavigation,
  isHistoryGatewayReturn,
  MF_GATEWAY_BACK_RECONCILE_ATTEMPTS,
} from "@/features/invest/lib/mf-payment-gateway-return";
import { formatInr } from "@/features/invest/lib/mf-format";
import { resolveSipFailureReason } from "@/features/invest/lib/mf-sip-failure-copy";
import {
  clearMfSipFirstInstallmentRedirect,
  clearMfSipMandateAutoRedirectBlocked,
  clearMfSipMandateRedirect,
  clearMfSipPaymentSession,
  getNextMfSipCartCheckoutPlanId,
  markMfSipFirstInstallmentAutoStarted,
  markMfSipFirstInstallmentRedirect,
  markMfSipMandateAutoRedirectBlocked,
  markMfSipMandateRedirect,
  removeMfSipCartCheckoutPlan,
  wasMfSipFirstInstallmentAutoStarted,
  wasMfSipFirstInstallmentRedirected,
  wasMfSipMandateAutoRedirectBlocked,
  wasMfSipMandateRedirected,
  wasMfSipPaymentDismissed,
  getMfPaymentGatewayMode,
  isMfPaymentFullPageGatewayReturn,
} from "@/features/invest/lib/mf-payment-session";
import { copy } from "@/shared/config/copy";
import { useInvestCacheInvalidation } from "@/features/invest/hooks/use-invest-cache-invalidation";
import { useMfPaymentOverlayOptional } from "@/features/invest/contexts/mf-payment-overlay-context";
import { useMfPaymentGatewayPopup } from "@/features/invest/hooks/use-mf-payment-gateway-popup";
import { launchMfPaymentGatewayUrl } from "@/features/invest/lib/mf-payment-gateway-popup";

const SIP_UNAVAILABLE_FAILURE_CODES = new Set(["scheme_not_available", "sip_not_allowed"]);

type MfSipMandateViewProps = {
  planId: string;
  onClose?: () => void;
};

const TERMINAL_STATUSES = new Set(["ACTIVE", "FAILED", "CANCELLED"]);
const POLL_MS = 2000;
const FIRST_INSTALLMENT_RETURN_POLLS = 5;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

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

async function reconcileFirstInstallmentReturn(planId: string) {
  let latest = await confirmMfSipFirstInstallmentReturn(planId);
  for (let attempt = 0; attempt < FIRST_INSTALLMENT_RETURN_POLLS; attempt += 1) {
    if (!isFirstInstallmentPending(latest)) {
      return latest;
    }
    await sleep(POLL_MS);
    latest = await confirmMfSipFirstInstallmentReturn(planId);
  }
  return latest;
}

function isSipSetupComplete(plan: MfSipPlan | null): boolean {
  if (!plan || plan.status !== "ACTIVE") return false;
  if (isBankSwitchFlow(plan) && !isBankSwitchComplete(plan)) return false;
  return !isFirstInstallmentPending(plan);
}

function needsMandateAuthorization(plan: MfSipPlan | null): boolean {
  if (!plan) return false;
  return (
    plan.next_action === "authorize_mandate" || plan.next_action === "authorize_mandate_switch"
  );
}

function attemptMandateAuthRedirect(args: {
  plan: MfSipPlan;
  planId: string;
  redirectedRef: MutableRefObject<boolean>;
  allowAutoRedirect: boolean;
  launchAuthUrl: (authUrl: string) => boolean;
}): boolean {
  if (!args.allowAutoRedirect || wasMfSipMandateAutoRedirectBlocked(args.planId)) return false;

  const authUrl = resolveMandateAuthUrl(args.plan);
  if (!authUrl || !needsMandateAuthorization(args.plan)) return false;
  if (TERMINAL_STATUSES.has(args.plan.status) && !isBankSwitchFlow(args.plan)) return false;
  if (args.redirectedRef.current || wasMfSipMandateRedirected(args.planId)) return false;

  args.redirectedRef.current = true;
  if (!args.launchAuthUrl(authUrl)) {
    args.redirectedRef.current = false;
    return false;
  }
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
  gatewayBackIncomplete: boolean;
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
    gatewayBackIncomplete,
  } = args;

  if (returnConfirming || redirectingToFirstInstallment) return "waiting";
  if (gatewayBackIncomplete && !isSipSetupComplete(plan)) return "error";
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

function shouldAbandonIncompleteMandate(
  plan: MfSipPlan | null,
  mandateAutoRedirectBlocked: boolean,
) {
  if (!plan) return false;
  if (TERMINAL_STATUSES.has(plan.status)) return false;
  if (isBankSwitchFlow(plan)) return false;
  if (mandateAutoRedirectBlocked && needsMandateAuthorization(plan)) return true;
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
  const mandateAutoRedirectBlockedRef = useRef(wasMfSipMandateAutoRedirectBlocked(planId));
  const [mandateAutoRedirectBlocked, setMandateAutoRedirectBlocked] = useState(
    () => wasMfSipMandateAutoRedirectBlocked(planId),
  );
  const [historyGatewayReturn, setHistoryGatewayReturn] = useState(
    () =>
      (wasMfSipMandateRedirected(planId) || wasMfSipFirstInstallmentRedirected(planId)) &&
      (isHistoryBackForwardNavigation() || getGatewayReturnKind() === "history"),
  );
  const [gatewayBackIncomplete, setGatewayBackIncomplete] = useState(false);
  const returnedFromMandate =
    wasMfSipMandateRedirected(planId) && isMfPaymentFullPageGatewayReturn(planId);

  const signalSipGatewayReturn = useCallback(() => {
    mandateReturnConfirmRef.current = false;
    setRedirectingToFirstInstallment(false);
    setAbandonChecked(false);
    setReturnRetryToken((token) => token + 1);
  }, []);

  const { attachPopup } = useMfPaymentGatewayPopup({
    planId,
    onGatewayReturn: signalSipGatewayReturn,
    onPopupClosedWithoutReturn: signalSipGatewayReturn,
  });

  const launchSipGatewayUrl = useCallback(
    (url: string, kind: "mandate" | "first_installment") => {
      const { popup, result } = launchMfPaymentGatewayUrl(url);
      if (result === "same_tab") {
        if (kind === "mandate") {
          markMfSipMandateRedirect(planId, "full_page");
        } else {
          markMfSipFirstInstallmentRedirect(planId, "full_page");
        }
        return true;
      }
      if (result === "popup" && popup) {
        if (kind === "mandate") {
          markMfSipMandateRedirect(planId, "popup");
        } else {
          markMfSipFirstInstallmentRedirect(planId, "popup");
        }
        attachPopup(popup);
        return true;
      }
      setError(copy.mutualFunds.paymentGatewayPopupBlocked);
      return false;
    },
    [attachPopup, planId],
  );

  const syncMandateAutoRedirectBlocked = useCallback((blocked: boolean) => {
    mandateAutoRedirectBlockedRef.current = blocked;
    setMandateAutoRedirectBlocked(blocked);
  }, []);

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
        attemptMandateAuthRedirect({
          plan: next,
          planId,
          redirectedRef,
          allowAutoRedirect: !mandateAutoRedirectBlockedRef.current,
          launchAuthUrl: (authUrl) => launchSipGatewayUrl(authUrl, "mandate"),
        });
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
  }, [launchSipGatewayUrl, planId]);

  const startMandateAuthorization = useCallback(async () => {
    if (!plan || !needsMandateAuthorization(plan)) return;
    const mandateId = plan.mandate?.mandate_id;
    if (!mandateId) return;

    try {
      clearMfSipMandateAutoRedirectBlocked(planId);
      syncMandateAutoRedirectBlocked(false);
      redirectedRef.current = false;

      const refreshedMandate = await authMfMandate(mandateId);
      const authUrl = refreshedMandate.auth_url?.trim() || "";
      if (!authUrl) {
        throw new Error(copy.mutualFunds.sipMandateAuthRetry);
      }
      const updatedPlan: MfSipPlan = {
        ...plan,
        mandate_auth_url: authUrl,
        mandate: plan.mandate
          ? {
              ...plan.mandate,
              auth_url: refreshedMandate.auth_url ?? plan.mandate.auth_url,
            }
          : plan.mandate,
      };
      setPlan(updatedPlan);
      setError(null);

      if (authUrl) {
        redirectedRef.current = true;
        if (!launchSipGatewayUrl(authUrl, "mandate")) {
          redirectedRef.current = false;
        }
      }
    } catch (err) {
      markMfSipMandateAutoRedirectBlocked(planId);
      syncMandateAutoRedirectBlocked(true);
      setError(err instanceof Error ? err.message : copy.mutualFunds.sipLoadError);
      const next = await fetchMfSipPlan(planId);
      if (next) setPlan(next);
    }
  }, [launchSipGatewayUrl, plan, planId, syncMandateAutoRedirectBlocked]);

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
          if (!launchSipGatewayUrl(payment.payment_url, "first_installment")) {
            redirectedRef.current = false;
            setRedirectingToFirstInstallment(false);
          }
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
    [launchSipGatewayUrl, plan, planId],
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
      if (getMfPaymentGatewayMode(planId) === "popup") return;
      if (dismissedRef.current || wasMfSipPaymentDismissed(planId)) return;
      const pendingMandate = wasMfSipMandateRedirected(planId);
      const pendingFirst = wasMfSipFirstInstallmentRedirected(planId);
      if (!pendingMandate && !pendingFirst) return;
      mandateReturnConfirmRef.current = false;
      setRedirectingToFirstInstallment(false);
      setAbandonChecked(false);
      if (isHistoryGatewayReturn(event) || getGatewayReturnKind() === "history") {
        setHistoryGatewayReturn(true);
      }
      setReturnRetryToken((token) => token + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [planId]);

  useEffect(() => {
    const concludeUnpaidReturn = historyGatewayReturn || getGatewayReturnKind() === "postback";

    if (wasMfSipFirstInstallmentRedirected(planId)) {
      if (getMfPaymentGatewayMode(planId) === "popup" && returnRetryToken === 0) {
        setAbandonChecked(true);
        return;
      }
      let cancelled = false;
      setReturnConfirming(true);

      void (async () => {
        try {
          const next = await reconcileFirstInstallmentReturn(planId);
          if (!cancelled && next) {
            setPlan(next);
            if (concludeUnpaidReturn && isFirstInstallmentPending(next)) {
              setGatewayBackIncomplete(true);
              setFirstInstallmentRetryOffered(true);
              setError(copy.mutualFunds.sipFirstInstallmentRetry);
            } else {
              if (isFirstInstallmentPending(next)) {
                setFirstInstallmentRetryOffered(true);
              }
              setError(null);
            }
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : copy.mutualFunds.sipLoadError);
            setFirstInstallmentRetryOffered(true);
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
    if (getMfPaymentGatewayMode(planId) === "popup" && returnRetryToken === 0) {
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
        if (
          concludeUnpaidReturn &&
          next &&
          !isSipSetupComplete(next) &&
          needsMandateAuthorization(next)
        ) {
          for (let attempt = 0; attempt < MF_GATEWAY_BACK_RECONCILE_ATTEMPTS; attempt += 1) {
            await sleep(POLL_MS);
            next = await confirmMfSipMandateReturn(planId);
            if (!next || isSipSetupComplete(next) || !needsMandateAuthorization(next)) break;
          }
          if (next && !isSipSetupComplete(next) && needsMandateAuthorization(next)) {
            try {
              next = await abandonMfSipMandate(planId);
            } catch {
              // Keep the refreshed plan and still show the not-completed dialog.
            }
          }
        }
        setPlan(next);
        if (
          concludeUnpaidReturn &&
          next &&
          !isSipSetupComplete(next) &&
          (needsMandateAuthorization(next) || next.status === "FAILED" || next.status === "CANCELLED")
        ) {
          setGatewayBackIncomplete(true);
          setError(next.failure_reason?.trim() || copy.mutualFunds.sipMandateAbandoned);
        } else {
          setError(null);
        }
      } catch {
        const next = await loadPlan();
        if (next) setPlan(next);
      } finally {
        markMfSipMandateAutoRedirectBlocked(planId);
        syncMandateAutoRedirectBlocked(true);
        clearMfSipMandateRedirect(planId);
        setLoading(false);
        setAbandonChecked(true);
      }
    })();
  }, [historyGatewayReturn, loadPlan, planId, returnRetryToken, syncMandateAutoRedirectBlocked]);

  useEffect(() => {
    if (!abandonChecked || returnConfirming || dismissedRef.current) return;
    if (!plan || !isFirstInstallmentPending(plan)) return;
    if (gatewayBackIncomplete || firstInstallmentRetryOffered || wasMfSipFirstInstallmentAutoStarted(planId)) return;
    if (redirectedRef.current) return;

    markMfSipFirstInstallmentAutoStarted(planId);
    void startFirstInstallmentPayment({ auto: true });
  }, [
    abandonChecked,
    firstInstallmentRetryOffered,
    gatewayBackIncomplete,
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
    attemptMandateAuthRedirect({
      plan,
      planId,
      redirectedRef,
      allowAutoRedirect: !mandateAutoRedirectBlockedRef.current,
      launchAuthUrl: (authUrl) => launchSipGatewayUrl(authUrl, "mandate"),
    });
  }, [launchSipGatewayUrl, plan, planId]);

  const returnedFromFirstInstallment =
    firstInstallmentRetryOffered ||
    (wasMfSipFirstInstallmentRedirected(planId) && isMfPaymentFullPageGatewayReturn(planId));

  const phase = resolveSipMandatePhase({
    loading,
    plan,
    error,
    abandonChecked,
    returnedFromMandate,
    returnedFromFirstInstallment,
    returnConfirming,
    redirectingToFirstInstallment,
    gatewayBackIncomplete,
  });
  const message = resolveSipMandateMessage({
    phase,
    plan,
    error,
    returnedFromMandate,
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
  const mandateAuthDue =
    mandateAutoRedirectBlocked &&
    needsMandateAuthorization(plan) &&
    !mandateAlreadyApproved(plan) &&
    !returnConfirming &&
    !redirectingToFirstInstallment;
  const firstInstallmentDue =
    isFirstInstallmentPending(plan) &&
    !redirectingToFirstInstallment &&
    !returnConfirming &&
    (firstInstallmentRetryOffered || wasMfSipFirstInstallmentAutoStarted(planId));
  const firstInstallmentPending = isFirstInstallmentPending(plan);
  const useCtaLayout =
    phase !== "error" &&
    (mandateAuthDue || firstInstallmentDue || firstInstallmentRetryOffered);
  const useTerminalLayout =
    isInProgress &&
    !firstInstallmentPending &&
    !useCtaLayout &&
    !redirectingToFirstInstallment;

  const title =
    phase === "error"
      ? gatewayBackIncomplete
        ? copy.mutualFunds.paymentJourneyFailedTitle
        : copy.mutualFunds.sipJourneyFailedTitle
      : phase === "success"
        ? copy.mutualFunds.sipJourneySuccessTitle
        : copy.mutualFunds.sipMandateTitle;

  function dismissMandateDialog() {
    dismissedRef.current = true;
    clearMfSipPaymentSession(planId);

    if (shouldAbandonIncompleteMandate(plan, mandateAutoRedirectBlocked)) {
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
      layout={useTerminalLayout ? "terminal" : useCtaLayout ? "cta" : "default"}
      allowDismiss={
        mandateAuthDue ||
        firstInstallmentPending ||
        firstInstallmentDue ||
        firstInstallmentRetryOffered ||
        redirectingToFirstInstallment ||
        phase === "success" ||
        phase === "error"
      }
      title={
        useCtaLayout && plan
          ? withSipAmount(copy.mutualFunds.sipMandateCtaHeadline, plan)
          : title
      }
      subtitle={
        plan && !useCtaLayout && !useTerminalLayout && !isInProgress
          ? copy.mutualFunds.sipMandateAmountSubtitle.replace("{amount}", formatSipAmount(plan))
          : undefined
      }
      message={message}
      statusDetail={
        !useCtaLayout && !useTerminalLayout && !isInProgress
          ? resolveSipMandateStatusDetail(plan)
          : undefined
      }
      terminalLines={terminalLines}
      onDismiss={dismissMandateDialog}
      primaryLabel={
        mandateAuthDue
          ? copy.mutualFunds.sipMandateCta
          : firstInstallmentDue
            ? copy.mutualFunds.sipFirstInstallmentCta
            : phase === "success" || phase === "error"
              ? copy.mutualFunds.backToBrowse
              : undefined
      }
      onPrimaryAction={
        mandateAuthDue
          ? () => void startMandateAuthorization()
          : firstInstallmentDue
            ? () => void startFirstInstallmentPayment()
            : phase === "success" || phase === "error"
              ? dismissMandateDialog
              : undefined
      }
    />
  );
}
