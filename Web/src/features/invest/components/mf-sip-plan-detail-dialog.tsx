"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Copy, Loader2, ShieldCheck, ShieldOff, ArrowLeftRight, CircleX, Smartphone } from "lucide-react";

import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { BankLogo } from "@/components/banking/bank-logo";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  cancelMfMandate,
  cancelMfSipPlan,
  fetchMfSipPlanJourney,
  type MfMandate,
  type MfSipPlan,
  type MfSipPlanJourneyResponse,
} from "@/features/invest/api/invest-api";
import {
  fetchInvestorBankAccounts,
  type InvestorBankAccount,
} from "@/features/invest/lib/investor-bank-accounts-api";
import { MfSipPlanBankSwitchDialog } from "@/features/invest/components/mf-sip-plan-bank-switch-dialog";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import {
  MfSipPlanStatusBadge,
  mfSipPlanStatusVariantFromStatus,
} from "@/features/invest/components/mf-sip-plan-status-badge";
import {
  MF_JOURNEY_DIALOG_BODY_SHELL_CLASS,
  MF_JOURNEY_DIALOG_GRID_CLASS,
  MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS,
  MfJourneyDialogSkeleton,
} from "@/features/invest/components/payment-dialog/mf-journey-dialog-skeleton";
import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { invalidateInvestQueries } from "@/features/invest/lib/invalidate-invest-queries";
import {
  buildSipPlanJourneyView,
  type SipPlanJourneyDisplayStep,
} from "@/features/invest/lib/mf-sip-plan-journey-copy";
import { formatDate, formatDateTime, formatInr, formatSipFrequencyLabel, formatSipInstallmentCount, formatSipInstallmentDay, formatSipNextInstallmentDate, isSipNextInstallmentNoData } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfSipPlanDetailDialogProps = {
  open: boolean;
  planId: string | null;
  onOpenChange: (open: boolean) => void;
  onPlanUpdated?: () => void;
};

const CANCELLABLE_SIP_STATUSES = new Set(["ACTIVE", "PENDING", "REVIEW", "CONSENT_PENDING"]);
const CANCELLABLE_MANDATE_STATUSES = new Set(["APPROVED", "AUTH_PENDING", "PENDING"]);
const TERMINAL_SIP_STATUSES = new Set(["CANCELLED", "CANCELED", "FAILED"]);

function isMandateCancelled(mandate: { status?: string | null; fp_mandate_status?: string | null }) {
  const status = (mandate.status ?? "").trim().toUpperCase();
  const fpStatus = (mandate.fp_mandate_status ?? "").trim().toUpperCase();
  return status === "CANCELLED" || fpStatus === "CANCELLED" || fpStatus === "CANCELED";
}

function formatFrequency(plan: MfSipPlan) {
  return formatSipFrequencyLabel(plan.frequency);
}

function formatMandateStatus(status: string) {
  return status
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type PaymentBankDisplay = {
  bank_name: string | null;
  bank_account_masked: string;
  bank_ifsc_code: string | null;
};

function resolveMandatePaymentBank(
  mandate: MfMandate | null | undefined,
  bankAccounts: InvestorBankAccount[],
): PaymentBankDisplay | null {
  if (!mandate) return null;

  if (mandate.bank_account_masked) {
    return {
      bank_name: mandate.bank_name,
      bank_account_masked: mandate.bank_account_masked,
      bank_ifsc_code: mandate.bank_ifsc_code,
    };
  }

  const linked = mandate.investor_bank_account_id
    ? bankAccounts.find((account) => account.id === mandate.investor_bank_account_id)
    : undefined;
  const account = linked ?? bankAccounts.find((item) => item.is_primary) ?? bankAccounts[0];
  if (!account) return null;

  return {
    bank_name: account.bank_name ?? null,
    bank_account_masked: account.account_number_masked,
    bank_ifsc_code: account.ifsc_code,
  };
}

function JourneyStepRow({ step, isLast }: { step: SipPlanJourneyDisplayStep; isLast: boolean }) {
  const isTerminal = step.isTerminal;

  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-3">
      <div className="flex flex-col items-center self-stretch pt-1">
        <span
          className={cn(
            "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            isTerminal ? "border-destructive/50 bg-destructive/10" : "border-primary/30 bg-primary/10",
          )}
        >
          <span className={cn("size-2 rounded-full", isTerminal ? "bg-destructive" : "bg-primary")} />
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
      </div>

      <div className={cn("min-w-0", !isLast && "pb-4")}>
        <p className="font-medium text-foreground">{step.title}</p>
        {step.description ? (
          <p className="mt-1.5 text-compact leading-relaxed text-muted-foreground">{step.description}</p>
        ) : null}
        <p className="mt-2 text-caption text-muted-foreground">
          {formatDateTime(step.event.created_at)}
          <span className="mx-1.5 text-border">·</span>
          {step.actor}
        </p>
      </div>

      <div className={cn("flex shrink-0 justify-end pt-0.5", !isLast && "pb-4")}>
        <StatusBadge
          variant={isTerminal ? "destructive" : mfSipPlanStatusVariantFromStatus(step.event.to_status)}
          className="normal-case"
        >
          {step.toStatus}
        </StatusBadge>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  children,
  icon,
}: {
  label: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="mt-1">{children}</div>
        </div>
        {icon}
      </div>
    </div>
  );
}

function SipPlanActionIconButton({
  label,
  icon: Icon,
  disabled,
  loading,
  destructive = false,
  onClick,
}: {
  label: string;
  icon: typeof Smartphone;
  disabled: boolean;
  loading: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  const isDisabled = disabled || loading;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn("inline-flex", isDisabled && "cursor-not-allowed")}
            tabIndex={isDisabled ? 0 : undefined}
          />
        }
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn(
            "rounded-[var(--radius-control)]",
            destructive &&
              !isDisabled &&
              "text-destructive hover:bg-destructive/10 hover:text-destructive",
          )}
          disabled={isDisabled}
          onClick={onClick}
          aria-label={label}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Icon className="size-4" strokeWidth={2.25} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function SipPlanHeaderActions({
  canAuthorize,
  canContinueBankSwitch,
  canCancelSip,
  canCancelMandate,
  actionLoading,
  onAuthorize,
  onContinueBankSwitch,
  onCancelSip,
  onCancelMandate,
}: {
  canAuthorize: boolean;
  canContinueBankSwitch: boolean;
  canCancelSip: boolean;
  canCancelMandate: boolean;
  actionLoading: boolean;
  onAuthorize: () => void;
  onContinueBankSwitch: () => void;
  onCancelSip: () => void;
  onCancelMandate: () => void;
}) {
  const primaryEnabled = canAuthorize || canContinueBankSwitch;
  const primaryUsesBankSwitch = canContinueBankSwitch && !canAuthorize;

  return (
    <TooltipProvider>
      <div className="flex shrink-0 items-center gap-1">
        <SipPlanActionIconButton
          label={
            primaryUsesBankSwitch
              ? copy.mySips.continueBankSwitch
              : copy.mySips.authorizeMandate
          }
          icon={primaryUsesBankSwitch ? ArrowLeftRight : Smartphone}
          disabled={!primaryEnabled || actionLoading}
          loading={actionLoading}
          onClick={primaryUsesBankSwitch ? onContinueBankSwitch : onAuthorize}
        />
        <SipPlanActionIconButton
          label={copy.mySips.cancelSip}
          icon={CircleX}
          disabled={!canCancelSip || actionLoading}
          loading={actionLoading}
          destructive
          onClick={onCancelSip}
        />
        <SipPlanActionIconButton
          label={copy.mySips.cancelMandate}
          icon={ShieldOff}
          disabled={!canCancelMandate || actionLoading}
          loading={actionLoading}
          destructive
          onClick={onCancelMandate}
        />
      </div>
    </TooltipProvider>
  );
}

function SipPlanSummaryPanel({
  plan,
  paymentBank,
  onSwitchDebitBank,
  actionError,
  canAuthorize,
  canContinueBankSwitch,
  canCancelSip,
  canCancelMandate,
  actionLoading,
  onAuthorize,
  onContinueBankSwitch,
  onCancelSip,
  onCancelMandate,
}: {
  plan: MfSipPlan;
  paymentBank: PaymentBankDisplay | null;
  onSwitchDebitBank?: () => void;
  actionError: string | null;
  canAuthorize: boolean;
  canContinueBankSwitch: boolean;
  canCancelSip: boolean;
  canCancelMandate: boolean;
  actionLoading: boolean;
  onAuthorize: () => void;
  onContinueBankSwitch: () => void;
  onCancelSip: () => void;
  onCancelMandate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const amcName = plan.amc_name ?? copy.mutualFunds.unknownAmc;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plan.plan_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside
      className={cn(
        "border-b border-border/60 bg-muted/10 p-5 sm:p-6 md:border-b-0 md:border-r",
        MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <MfFundAmcAvatar
            amcLogoUrl={plan.amc_logo_url}
            amcName={amcName}
            size="md"
            className="size-14 shrink-0 text-caption"
          />
          <div className="min-w-0 text-left">
            <p className="text-body font-semibold leading-snug text-foreground">
              {plan.product_name ?? copy.mutualFunds.unknownFund}
            </p>
            <p className="mt-1 text-caption text-muted-foreground">{amcName}</p>
            {plan.isin ? (
              <p className="mt-1 font-mono text-caption text-muted-foreground">
                {copy.mySips.detailIsin} {plan.isin}
              </p>
            ) : null}
          </div>
        </div>

        <SipPlanHeaderActions
          canAuthorize={canAuthorize}
          canContinueBankSwitch={canContinueBankSwitch}
          canCancelSip={canCancelSip}
          canCancelMandate={canCancelMandate}
          actionLoading={actionLoading}
          onAuthorize={onAuthorize}
          onContinueBankSwitch={onContinueBankSwitch}
          onCancelSip={onCancelSip}
          onCancelMandate={onCancelMandate}
        />
      </div>

      {actionError ? (
        <div className="mt-3">
          <FieldMessage variant="error" message={actionError} />
        </div>
      ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SummaryCard label={copy.mySips.tableAmount}>
            <p className="text-h4 font-semibold tabular-nums text-foreground">{formatInr(plan.amount_inr)}</p>
          </SummaryCard>

          {paymentBank ? (
            <SummaryCard label={copy.mutualFunds.bankPickerPayoutLabel}>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <BankLogo
                    bankName={paymentBank.bank_name}
                    ifscCode={paymentBank.bank_ifsc_code}
                    accountLabel={paymentBank.bank_account_masked}
                    size="sm"
                    fallbackClassName="bg-primary/10 text-primary ring-primary/20"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-compact font-semibold tabular-nums text-foreground">
                      {paymentBank.bank_account_masked}
                    </p>
                    <p className="truncate text-caption text-muted-foreground">
                      {paymentBank.bank_name?.trim() || copy.mutualFunds.bankPickerUnknownBank}
                    </p>
                  </div>
                </div>
                {plan.bank_switch?.in_progress ? (
                  <StatusBadge variant="warning" className="h-5 px-2 text-[10px]">
                    {copy.mySips.bankSwitch.inProgressBadge}
                  </StatusBadge>
                ) : plan.bank_switch?.used ? (
                  <StatusBadge variant="success" className="h-5 px-2 text-[10px]">
                    {copy.mySips.bankSwitch.usedBadge}
                  </StatusBadge>
                ) : null}
                {onSwitchDebitBank ? (
                  <Button type="button" size="sm" variant="outline" onClick={onSwitchDebitBank}>
                    {copy.mySips.bankSwitch.action}
                  </Button>
                ) : null}
              </div>
            </SummaryCard>
          ) : null}

          <SummaryCard label={copy.transactions.journeyLatestStatus}>
            <MfSipPlanStatusBadge plan={plan} />
          </SummaryCard>

          <SummaryCard label={copy.mySips.detailFrequency}>
            <p className="text-compact font-semibold text-foreground">{formatFrequency(plan)}</p>
          </SummaryCard>

          {(plan.frequency ?? "").trim().toLowerCase() !== "daily" ? (
            <SummaryCard label={copy.mySips.detailInstallmentDay}>
              <p className="text-compact font-semibold text-foreground">
                {formatSipInstallmentDay(plan.installment_day)}
              </p>
            </SummaryCard>
          ) : null}

          <SummaryCard label={copy.mySips.detailInstallmentCount}>
            <p className="text-compact font-semibold text-foreground">
              {formatSipInstallmentCount(plan.number_of_installments)}
            </p>
          </SummaryCard>

          <SummaryCard
            label={copy.mySips.detailNextInstallment}
            icon={<CalendarClock className="size-4 shrink-0 text-muted-foreground/70" strokeWidth={2.25} />}
          >
            <p
              className={cn(
                "text-compact font-medium",
                isSipNextInstallmentNoData(plan) ? "uppercase tracking-wide text-muted-foreground" : "text-foreground",
              )}
            >
              {formatSipNextInstallmentDate(plan)}
            </p>
          </SummaryCard>

          <SummaryCard
            label={copy.mySips.detailStartedOn}
            icon={<CalendarClock className="size-4 shrink-0 text-muted-foreground/70" strokeWidth={2.25} />}
          >
            <p className="text-compact font-medium text-foreground">
              {formatDateTime(plan.activated_at ?? plan.created_at)}
            </p>
          </SummaryCard>

          {plan.mandate ? (
            <SummaryCard
              label={copy.mySips.detailMandateStatus}
              icon={<ShieldCheck className="size-4 shrink-0 text-muted-foreground/70" strokeWidth={2.25} />}
            >
              <p className="text-compact font-semibold text-foreground">
                {isMandateCancelled(plan.mandate)
                  ? formatMandateStatus("cancelled")
                  : formatMandateStatus(plan.mandate.status)}
              </p>
            </SummaryCard>
          ) : null}

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 sm:col-span-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {copy.mySips.detailPlanId}
                </p>
                <p className="mt-1 break-all font-mono text-caption leading-relaxed text-foreground">
                  {plan.plan_id}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => void handleCopy()}
                aria-label={copy.mySips.copyPlanId}
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>
        </div>
    </aside>
  );
}

function SipPlanTimelinePanel({
  journey,
}: {
  journey: NonNullable<ReturnType<typeof buildSipPlanJourneyView>>;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col md:overflow-hidden">
      <div className={cn("p-5 sm:p-6", MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS, "md:flex-1")}>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 pr-2">
          <p className="min-w-0 flex-1 text-compact font-semibold text-foreground">
            {copy.transactions.journeyWhatHappened}
          </p>
          {journey.steps.length > 0 ? (
            <StatusBadge variant="neutral" showIcon={false} className="shrink-0 whitespace-nowrap">
              {journey.steps.length} step{journey.steps.length === 1 ? "" : "s"}
            </StatusBadge>
          ) : null}
        </div>

        {journey.steps.length === 0 ? (
          <p className="text-compact text-muted-foreground">{copy.transactions.journeyEmpty}</p>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-muted/10 px-3 py-4 sm:px-4">
            {journey.steps.map((step, index) => (
              <JourneyStepRow
                key={`${step.event.created_at ?? "event"}-${index}`}
                step={step}
                isLast={index === journey.steps.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function MfSipPlanDetailDialog({
  open,
  planId,
  onOpenChange,
  onPlanUpdated,
}: MfSipPlanDetailDialogProps) {
  const queryClient = useQueryClient();
  const { openSipMandate } = useMfPaymentOverlay();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MfSipPlanJourneyResponse | null>(null);
  const [bankAccounts, setBankAccounts] = useState<InvestorBankAccount[]>([]);
  const [cancelSipOpen, setCancelSipOpen] = useState(false);
  const [cancelMandateOpen, setCancelMandateOpen] = useState(false);
  const [switchBankOpen, setSwitchBankOpen] = useState(false);

  const loadJourney = async (targetPlanId: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchMfSipPlanJourney(targetPlanId);
      setDetail(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mySips.loadError);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !planId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchMfSipPlanJourney(planId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || copy.mySips.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, planId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void fetchInvestorBankAccounts()
      .then((result) => {
        if (!cancelled) setBankAccounts(result.bank_accounts);
      })
      .catch(() => {
        if (!cancelled) setBankAccounts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActionError(null);
    setCancelSipOpen(false);
    setCancelMandateOpen(false);
    setSwitchBankOpen(false);
  }, [open]);

  const plan = detail?.plan ?? null;

  const journey = useMemo(
    () => (detail ? buildSipPlanJourneyView(detail.plan, detail.events) : null),
    [detail],
  );

  const paymentBank = useMemo(
    () => (plan ? resolveMandatePaymentBank(plan.mandate, bankAccounts) : null),
    [plan, bankAccounts],
  );

  const canAuthorize =
    plan?.next_action === "authorize_mandate" || plan?.next_action === "authorize_mandate_switch";
  const canContinueBankSwitch =
    Boolean(plan?.bank_switch?.in_progress) &&
    (plan?.next_action === "authorize_mandate_switch" ||
      plan?.next_action === "wait_bank_switch" ||
      plan?.next_action === "wait_mandate");
  const canSwitchDebitBank =
    (plan?.status ?? "").toUpperCase() === "ACTIVE" &&
    Boolean(plan?.bank_switch?.eligible) &&
    !plan?.bank_switch?.used &&
    !plan?.bank_switch?.in_progress;
  const canCancelSip = plan ? CANCELLABLE_SIP_STATUSES.has((plan.status ?? "").toUpperCase()) : false;
  const canCancelMandate =
    plan?.mandate &&
    !isMandateCancelled(plan.mandate) &&
    CANCELLABLE_MANDATE_STATUSES.has((plan.mandate.status ?? "").toUpperCase()) &&
    !TERMINAL_SIP_STATUSES.has((plan.status ?? "").toUpperCase()) &&
    (plan.status ?? "").toUpperCase() !== "ACTIVE";

  const handleCancelSip = async () => {
    if (!plan || actionLoading) return;
    setCancelSipOpen(false);
    setActionLoading(true);
    setActionError(null);
    try {
      await cancelMfSipPlan(plan.plan_id);
      await loadJourney(plan.plan_id);
      await invalidateInvestQueries(queryClient);
      onPlanUpdated?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : copy.mySips.cancelError);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMandate = async () => {
    if (!plan?.mandate || actionLoading) return;
    setCancelMandateOpen(false);
    setActionLoading(true);
    setActionError(null);
    try {
      await cancelMfMandate(plan.mandate.mandate_id);
      await loadJourney(plan.plan_id);
      await invalidateInvestQueries(queryClient);
      onPlanUpdated?.();
    } catch (err) {
      const refreshed = await loadJourney(plan.plan_id);
      const refreshedMandate = refreshed?.plan.mandate;
      if (refreshedMandate && isMandateCancelled(refreshedMandate)) {
        setActionError(null);
        await invalidateInvestQueries(queryClient);
        onPlanUpdated?.();
        return;
      }
      setActionError(err instanceof Error ? err.message : copy.mySips.cancelError);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAuthorize = () => {
    if (!plan) return;
    onOpenChange(false);
    openSipMandate(plan.plan_id);
  };

  const handleContinueBankSwitch = () => {
    if (!plan) return;
    onOpenChange(false);
    openSipMandate(plan.plan_id);
  };

  const handleSwitchStarted = async (updatedPlan: MfSipPlan) => {
    if (planId) {
      await loadJourney(planId);
      await invalidateInvestQueries(queryClient);
      onPlanUpdated?.();
    }
    const needsMandateFlow =
      updatedPlan.next_action === "authorize_mandate_switch" ||
      updatedPlan.next_action === "wait_bank_switch" ||
      updatedPlan.next_action === "wait_mandate";
    if (needsMandateFlow) {
      onOpenChange(false);
      openSipMandate(updatedPlan.plan_id);
    }
  };

  const currentBankAccountId = plan?.mandate?.investor_bank_account_id ?? null;

  return (
    <>
      <BrandDialog
        open={open}
        onOpenChange={onOpenChange}
        title={copy.mySips.detailTitle}
        maxWidth="xl"
        className="max-h-[min(90vh,44rem)] w-full max-w-[min(calc(100vw-2rem),60rem)]"
      >
        <div className={MF_JOURNEY_DIALOG_BODY_SHELL_CLASS}>
          {loading ? <MfJourneyDialogSkeleton variant="sip" /> : null}

          {error ? (
            <div className="flex items-center p-5 sm:p-6">
              <FieldMessage variant="error" message={error} />
            </div>
          ) : null}

          {!loading && !error && plan && journey ? (
            <div
              className={cn(
                MF_JOURNEY_DIALOG_GRID_CLASS,
                "md:grid-cols-[minmax(24rem,30rem)_minmax(0,1fr)]",
              )}
            >
              <SipPlanSummaryPanel
                plan={plan}
                paymentBank={paymentBank}
                onSwitchDebitBank={canSwitchDebitBank ? () => setSwitchBankOpen(true) : undefined}
                actionError={actionError}
                canAuthorize={Boolean(canAuthorize)}
                canContinueBankSwitch={Boolean(canContinueBankSwitch)}
                canCancelSip={Boolean(canCancelSip)}
                canCancelMandate={Boolean(canCancelMandate)}
                actionLoading={actionLoading}
                onAuthorize={handleAuthorize}
                onContinueBankSwitch={handleContinueBankSwitch}
                onCancelSip={() => setCancelSipOpen(true)}
                onCancelMandate={() => setCancelMandateOpen(true)}
              />
              <SipPlanTimelinePanel journey={journey} />
            </div>
          ) : null}
        </div>
      </BrandDialog>

      <ConfirmDialog
        open={cancelSipOpen}
        onOpenChange={setCancelSipOpen}
        variant="destructive"
        title={copy.mySips.cancelSipTitle}
        description={copy.mySips.cancelSipDescription}
        confirmLabel={copy.mySips.cancelConfirm}
        onConfirm={() => void handleCancelSip()}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={cancelMandateOpen}
        onOpenChange={setCancelMandateOpen}
        variant="destructive"
        title={copy.mySips.cancelMandateTitle}
        description={copy.mySips.cancelMandateDescription}
        confirmLabel={copy.mySips.cancelConfirm}
        onConfirm={() => void handleCancelMandate()}
        loading={actionLoading}
      />

      {plan ? (
        <MfSipPlanBankSwitchDialog
          open={switchBankOpen}
          plan={plan}
          currentBankAccountId={currentBankAccountId}
          onOpenChange={setSwitchBankOpen}
          onSwitchStarted={(updatedPlan) => void handleSwitchStarted(updatedPlan)}
        />
      ) : null}
    </>
  );
}
