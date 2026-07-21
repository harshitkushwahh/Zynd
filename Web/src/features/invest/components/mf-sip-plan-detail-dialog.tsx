"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarClock, Check, Copy, Hash, Loader2, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  cancelMfMandate,
  cancelMfSipPlan,
  fetchMfSipPlan,
  type MfSipPlan,
} from "@/features/invest/api/invest-api";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfPaymentStatusBadges } from "@/features/invest/components/payment-dialog";
import { MfSipPlanStatusBadge } from "@/features/invest/components/mf-sip-plan-status-badge";
import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { formatDate, formatDateTime, formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfSipPlanDetailDialogProps = {
  open: boolean;
  planId: string | null;
  onOpenChange: (open: boolean) => void;
  onPlanUpdated?: () => void;
};

const DIALOG_SURFACE_CLASS = "overflow-hidden rounded-[var(--radius-card)] border border-border bg-card";
const DIALOG_CLOSE_MS = 320;

const CANCELLABLE_SIP_STATUSES = new Set(["ACTIVE", "PENDING", "REVIEW", "CONSENT_PENDING"]);
const CANCELLABLE_MANDATE_STATUSES = new Set(["APPROVED", "AUTH_PENDING", "PENDING"]);

function DetailTile({
  icon: Icon,
  label,
  value,
  mono = false,
  className,
  action,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-[var(--radius-card)] border border-border bg-card p-3.5 shadow-zynd-low",
        className,
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-caption font-medium text-muted-foreground">{label}</p>
          {action}
        </div>
        <p
          className={cn(
            "mt-1 break-words text-compact font-medium text-foreground",
            mono && "break-all font-mono text-caption font-normal leading-relaxed",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function PlanIdTile({ planId }: { planId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(planId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <DetailTile
      icon={Hash}
      label={copy.mySips.detailPlanId}
      value={planId}
      mono
      className="sm:col-span-2"
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-caption text-muted-foreground hover:text-foreground"
          onClick={() => void handleCopy()}
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? copy.mySips.copied : copy.mySips.copyPlanId}
        </Button>
      }
    />
  );
}

function formatFrequency(plan: MfSipPlan) {
  const frequency = (plan.frequency ?? "").trim().toLowerCase();
  if (frequency === "daily") return copy.mySips.frequencyDaily;
  if (plan.installment_day) {
    return copy.mySips.installmentDay.replace("{day}", String(plan.installment_day));
  }
  return copy.mySips.frequencyMonthly;
}

function PlanFundSummary({ plan }: { plan: MfSipPlan }) {
  const amcName = plan.amc_name ?? copy.mutualFunds.unknownAmc;

  return (
    <section className={DIALOG_SURFACE_CLASS}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <MfFundAmcAvatar
              amcLogoUrl={plan.amc_logo_url}
              amcName={amcName}
              size="md"
              className="mt-0.5"
            />
            <div className="min-w-0">
              <p className="font-medium leading-snug text-foreground">
                {plan.product_name ?? copy.mutualFunds.unknownFund}
              </p>
              <p className="mt-0.5 text-caption text-muted-foreground">{amcName}</p>
              {plan.isin ? (
                <p className="mt-1 font-mono text-caption text-muted-foreground">
                  {copy.mySips.detailIsin} {plan.isin}
                </p>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-caption text-muted-foreground">{copy.mySips.tableAmount}</p>
            <p className="mt-0.5 text-body font-semibold tabular-nums text-foreground">
              {formatInr(plan.amount_inr)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-caption font-medium text-muted-foreground">{copy.mySips.tableStatus}</span>
          <MfSipPlanStatusBadge status={plan.status ?? "UNKNOWN"} />
        </div>
      </div>
    </section>
  );
}

function PlanDetailTiles({ plan }: { plan: MfSipPlan }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailTile
        icon={Wallet}
        label={copy.mySips.detailFrequency}
        value={formatFrequency(plan)}
      />
      <DetailTile
        icon={CalendarClock}
        label={copy.mySips.detailNextInstallment}
        value={formatDate(plan.next_installment_date)}
      />
      <DetailTile
        icon={CalendarClock}
        label={copy.mySips.detailStartedOn}
        value={formatDateTime(plan.activated_at ?? plan.created_at)}
      />
      {plan.mandate ? (
        <DetailTile
          icon={ShieldCheck}
          label={copy.mySips.detailMandateStatus}
          value={plan.mandate.status.replaceAll("_", " ")}
        />
      ) : null}
      {plan.mandate?.mandate_limit ? (
        <DetailTile
          icon={ShieldCheck}
          label={copy.mySips.detailMandateLimit}
          value={formatInr(plan.mandate.mandate_limit)}
        />
      ) : null}
      <PlanIdTile planId={plan.plan_id} />
    </div>
  );
}

export function MfSipPlanDetailDialog({
  open,
  planId,
  onOpenChange,
  onPlanUpdated,
}: MfSipPlanDetailDialogProps) {
  const { openSipMandate } = useMfPaymentOverlay();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [plan, setPlan] = useState<MfSipPlan | null>(null);
  const [cancelSipOpen, setCancelSipOpen] = useState(false);
  const [cancelMandateOpen, setCancelMandateOpen] = useState(false);

  useEffect(() => {
    if (!open || !planId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchMfSipPlan(planId)
      .then((result) => {
        if (!cancelled) setPlan(result);
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
    if (open) return;

    const timer = window.setTimeout(() => {
      setPlan(null);
      setError(null);
      setActionError(null);
      setLoading(false);
      setCancelSipOpen(false);
      setCancelMandateOpen(false);
    }, DIALOG_CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [open]);

  const canAuthorize = plan?.next_action === "authorize_mandate";
  const canCancelSip = plan ? CANCELLABLE_SIP_STATUSES.has((plan.status ?? "").toUpperCase()) : false;
  const canCancelMandate =
    plan?.mandate &&
    CANCELLABLE_MANDATE_STATUSES.has((plan.mandate.status ?? "").toUpperCase()) &&
    !["CANCELLED", "CANCELED"].includes((plan.mandate.fp_mandate_status ?? "").toUpperCase()) &&
    (plan.status ?? "").toUpperCase() !== "ACTIVE";

  const handleCancelSip = async () => {
    if (!plan || actionLoading) return;
    setCancelSipOpen(false);
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await cancelMfSipPlan(plan.plan_id);
      setPlan(updated);
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
      const updated = await fetchMfSipPlan(plan.plan_id);
      setPlan(updated);
      onPlanUpdated?.();
    } catch (err) {
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,44rem)] max-w-[min(100vw-2rem,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 items-center border-b border-border/60 px-5 py-4 text-center sm:px-6">
            <DialogTitle className="w-full text-center">{copy.mySips.detailTitle}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {copy.mySips.loading}
              </div>
            ) : null}

            {error ? <FieldMessage variant="error" message={error} /> : null}
            {actionError ? <FieldMessage variant="error" message={actionError} className="mb-4" /> : null}

            {!loading && !error && plan ? (
              <div className="space-y-4">
                <PlanFundSummary plan={plan} />
                <PlanDetailTiles plan={plan} />

                {plan.failure_reason ? (
                  <section className={DIALOG_SURFACE_CLASS}>
                    <div className="border-b border-border bg-muted/20 px-4 py-3">
                      <p className="text-compact font-semibold text-foreground">
                        {copy.mySips.detailFailureReason}
                      </p>
                    </div>
                    <div className="p-4 text-compact leading-relaxed text-muted-foreground sm:p-5">
                      {plan.failure_reason}
                    </div>
                  </section>
                ) : null}

                {plan.fp_state ? (
                  <div className="flex items-center gap-2">
                    <MfPaymentStatusBadges status={plan.status} fpState={plan.fp_state} />
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
                  {canAuthorize ? (
                    <Button type="button" className="sm:flex-1" onClick={handleAuthorize}>
                      {copy.mySips.authorizeMandate}
                    </Button>
                  ) : null}
                  {canCancelSip ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:flex-1"
                      disabled={actionLoading}
                      onClick={() => setCancelSipOpen(true)}
                    >
                      {copy.mySips.cancelSip}
                    </Button>
                  ) : null}
                  {canCancelMandate ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:flex-1"
                      disabled={actionLoading}
                      onClick={() => setCancelMandateOpen(true)}
                    >
                      {copy.mySips.cancelMandate}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
