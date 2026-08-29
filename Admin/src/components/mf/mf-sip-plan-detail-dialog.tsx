"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Landmark, Repeat2, RotateCcw, ShieldCheck } from "lucide-react";

import { AmcLogo } from "@/components/mf/amc-logo";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { KycField, KycFieldGrid } from "@/components/users/admin-user-kyc-panel-shared";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format-date";
import { formatFriendlyStatus } from "@/lib/mf-order-journey-copy";
import {
  fetchMfTransactionSipPlanDetail,
  syncMfTransactionSipPlan,
  type MfTransactionSipMandate,
  type MfTransactionSipPlan,
  type MfTransactionSipPlanEvent,
} from "@/lib/mf-transactions-admin-api";
import { cn } from "@/lib/utils";

type PlanRecord = Record<string, unknown>;

type MfSipPlanDetailDialogProps = {
  open: boolean;
  planId: string | null;
  initialPlan?: PlanRecord | MfTransactionSipPlan | null;
  onClose: () => void;
};

function formatInr(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stringOrNull(value: unknown) {
  if (value == null || value === "") return null;
  return String(value);
}

function titleCase(value: unknown) {
  const text = stringOrNull(value);
  if (!text) return null;
  return text.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function planStatusVariant(status: unknown) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "active") return "success" as const;
  if (normalized === "failed") {
    return "destructive" as const;
  }
  if (normalized === "cancelled" || normalized === "canceled") {
    return "neutral" as const;
  }
  if (normalized === "pending" || normalized === "review" || normalized === "consent_pending") {
    return "warning" as const;
  }
  return "info" as const;
}

function frequencyLabel(frequency: unknown) {
  const value = String(frequency ?? "").toLowerCase();
  if (value === "monthly") return "Monthly";
  if (value === "daily") return "Daily";
  return titleCase(frequency) ?? "Recurring";
}

function installmentDayLabel(plan: MfTransactionSipPlan) {
  if (String(plan.frequency ?? "").toLowerCase() === "daily") return "Every day";
  if (plan.installment_day == null) return "—";
  return `Day ${plan.installment_day} of month`;
}

function asPlan(record: PlanRecord | MfTransactionSipPlan | null | undefined): MfTransactionSipPlan | null {
  if (!record) return null;
  const planId = stringOrNull(record.plan_id);
  if (!planId) return null;
  const amount = Number(record.amount_inr);
  return {
    ...(record as MfTransactionSipPlan),
    plan_id: planId,
    product_id: stringOrNull(record.product_id) ?? "",
    amount_inr: Number.isFinite(amount) ? amount : 0,
    frequency: stringOrNull(record.frequency) ?? "",
    number_of_installments: Number(record.number_of_installments) || 0,
    status: stringOrNull(record.status) ?? "",
    mandate: (record.mandate as MfTransactionSipMandate | null | undefined) ?? null,
  };
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    SYSTEM: "System",
    WORKER: "Automatic sync",
    USER: "Customer",
    WEBHOOK: "Provider update",
  };
  return labels[source.toUpperCase()] ?? titleCase(source) ?? source;
}

function JourneyEventRow({
  event,
  isLast,
}: {
  event: MfTransactionSipPlanEvent;
  isLast: boolean;
}) {
  const isFailed = event.to_status.toLowerCase() === "failed";
  const isCancelled = ["cancelled", "canceled"].includes(event.to_status.toLowerCase());
  const isTerminal = isFailed || isCancelled;

  return (
    <div className="flex gap-3">
      <div className="flex w-timeline-rail flex-col items-center self-stretch">
        <span
          className={cn(
            "relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full border",
            isFailed
              ? "border-destructive/40 bg-destructive/10"
              : isCancelled
                ? "border-border bg-muted/50"
                : "border-border bg-card",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              isFailed ? "bg-destructive" : isCancelled ? "bg-muted-foreground" : "bg-primary",
            )}
          />
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
      </div>
      <div
        className={cn(
          "mb-5 min-w-0 flex-1 rounded-[var(--radius-control)] border px-3 py-3",
          isFailed
            ? "border-destructive/35 bg-destructive/5"
            : isCancelled
              ? "border-border/70 bg-muted/20"
              : "border-border/70 bg-muted/10",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{formatFriendlyStatus(event.to_status)}</p>
          <StatusBadge variant={planStatusVariant(event.to_status)} showIcon={false}>
            {formatFriendlyStatus(event.to_status)}
          </StatusBadge>
        </div>
        {event.from_status ? (
          <p className="mt-1.5 text-compact text-muted-foreground">
            From {formatFriendlyStatus(event.from_status)}
          </p>
        ) : null}
        <p className="mt-2 text-caption text-muted-foreground">
          {formatTimestamp(event.created_at)} · {sourceLabel(event.source)}
        </p>
      </div>
    </div>
  );
}

function MandateBlock({ mandate }: { mandate: MfTransactionSipMandate }) {
  return (
    <article className="admin-user-investment-detail__block">
      <div className="admin-user-investment-detail__block-head">
        <ShieldCheck className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span>Mandate</span>
        <StatusBadge variant={planStatusVariant(mandate.status)} className="ml-auto" showIcon={false}>
          {formatFriendlyStatus(mandate.status)}
        </StatusBadge>
      </div>
      <KycFieldGrid>
        <KycField label="Type" value={titleCase(mandate.mandate_type)} />
        <KycField label="Limit" value={mandate.mandate_limit != null ? formatInr(mandate.mandate_limit) : null} />
        <KycField label="Bank" value={mandate.bank_name} />
        <KycField label="Account" value={mandate.bank_account_masked} />
        <KycField label="IFSC" value={mandate.bank_ifsc_code} />
        <KycField label="Provider status" value={titleCase(mandate.fp_mandate_status)} />
        <KycField label="Mandate ID" value={mandate.mandate_id} />
        <KycField label="Approved" value={formatDate(mandate.approved_at)} />
      </KycFieldGrid>
    </article>
  );
}

export function MfSipPlanDetailDialog({
  open,
  planId,
  initialPlan,
  onClose,
}: MfSipPlanDetailDialogProps) {
  const { hasPermission } = useAdminAuth();
  const canRead = hasPermission("mf.transactions.read");
  const canManage = hasPermission("mf.transactions.manage");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<MfTransactionSipPlan | null>(null);
  const [events, setEvents] = useState<MfTransactionSipPlanEvent[]>([]);

  const loadDetail = async (id: string) => {
    if (!canRead) {
      setPlan(asPlan(initialPlan));
      setEvents([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const detail = await fetchMfTransactionSipPlanDetail(id);
      const fetched = asPlan(detail.plan);
      const fallback = asPlan(initialPlan);
      setPlan(
        fetched
          ? {
              ...fallback,
              ...fetched,
              amc_name: fetched.amc_name ?? fallback?.amc_name,
              amc_logo_url: fetched.amc_logo_url ?? fallback?.amc_logo_url,
              product_name: fetched.product_name ?? fallback?.product_name,
            }
          : fallback,
      );
      setEvents(detail.events ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load SIP plan details."));
      setPlan(asPlan(initialPlan));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !planId) {
      setPlan(null);
      setEvents([]);
      setError("");
      return;
    }
    setPlan(asPlan(initialPlan));
    void loadDetail(planId);
    // initialPlan is only used as a first paint; refetch on planId/open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, planId, canRead]);

  const handleSync = async () => {
    if (!planId || !canManage) return;
    setSyncing(true);
    setError("");
    try {
      await syncMfTransactionSipPlan(planId);
      await loadDetail(planId);
    } catch (err) {
      setError(getErrorMessage(err, "Could not sync this SIP plan."));
    } finally {
      setSyncing(false);
    }
  };

  if (!open || !planId) return null;

  const name = plan?.product_name ?? "SIP plan";
  const bankSwitch = plan?.bank_switch;

  return (
    <AdminDetailDialog
      open={open}
      onClose={onClose}
      title={name}
      description={
        plan?.amc_name ? `${plan.amc_name} · Recurring SIP` : "Recurring SIP plan details"
      }
      icon={Repeat2}
      iconTone="info"
      size="wide"
      headerClassName="admin-user-investment-detail-dialog__header"
      headerAside={
        canManage ? (
          <Button size="sm" variant="outline" disabled={syncing} onClick={() => void handleSync()}>
            <RotateCcw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
            {syncing ? "Syncing…" : "Sync"}
          </Button>
        ) : undefined
      }
    >
      {loading && !plan ? (
        <AdminDetailDialogSkeleton />
      ) : error && !plan ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : plan ? (
        <div className="admin-user-investment-detail space-y-4">
          {error ? (
            <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
              {error}
            </AdminFeedbackMessage>
          ) : null}

          <div className="admin-user-investment-detail__fund">
            <AmcLogo name={plan.amc_name ?? name} logoUrl={plan.amc_logo_url} size="md" fallback="icon" />
            <div className="min-w-0">
              <p className="font-medium text-pretty break-words text-foreground">{name}</p>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {[plan.amc_name, frequencyLabel(plan.frequency)].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-2">
                <StatusBadge variant={planStatusVariant(plan.status)}>
                  {formatFriendlyStatus(plan.status)}
                </StatusBadge>
              </div>
            </div>
          </div>

          <article className="admin-user-investment-detail__block">
            <div className="admin-user-investment-detail__block-head">
              <CalendarClock className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              <span>Recurring schedule</span>
            </div>
            <AdminMetricCardsGrid columns="two" className="admin-user-investment-detail__metrics">
              <AdminMetricCard
                variant="secondary"
                icon={Repeat2}
                label="Installment"
                value={formatInr(plan.amount_inr)}
                hint={frequencyLabel(plan.frequency)}
              />
              <AdminMetricCard
                variant="secondary"
                icon={CalendarClock}
                label="Debit day"
                value={installmentDayLabel(plan)}
                hint={plan.number_of_installments ? `${plan.number_of_installments} installments` : "Open schedule"}
              />
              <AdminMetricCard
                variant="secondary"
                icon={CalendarClock}
                label="Next installment"
                value={formatDate(plan.next_installment_date) ?? "—"}
                hint={plan.activated_at ? `Active since ${formatDate(plan.activated_at)}` : "Scheduled debit"}
              />
              <AdminMetricCard
                variant="secondary"
                icon={Landmark}
                label="Created"
                value={formatDate(plan.created_at) ?? "—"}
                hint={titleCase(plan.next_action) ?? "SIP plan"}
              />
            </AdminMetricCardsGrid>
          </article>

          {plan.mandate ? <MandateBlock mandate={plan.mandate} /> : null}

          {bankSwitch?.in_progress || bankSwitch?.used || bankSwitch?.reason ? (
            <p className="admin-user-investment-detail__empty">
              {bankSwitch.in_progress
                ? "A bank switch is in progress for this SIP."
                : bankSwitch.reason ?? "Bank switch is not available for this plan."}
            </p>
          ) : null}

          {plan.failure_reason ? (
            <AdminFeedbackMessage variant="destructive" title={titleCase(plan.failure_code) ?? undefined}>
              {plan.failure_reason}
            </AdminFeedbackMessage>
          ) : null}

          <article className="admin-user-investment-detail__block">
            <div className="admin-user-investment-detail__block-head">
              <Repeat2 className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              <span>References</span>
            </div>
            <KycFieldGrid>
              <KycField label="Plan ID" value={plan.plan_id} />
              <KycField label="Provider plan" value={plan.fp_plan_id} />
              <KycField label="Product ID" value={plan.product_id} />
              <KycField label="ISIN" value={plan.isin} />
              <KycField label="Provider state" value={titleCase(plan.fp_state)} />
              <KycField label="Next action" value={titleCase(plan.next_action)} />
            </KycFieldGrid>
          </article>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-compact font-semibold text-foreground">Plan journey</p>
              <StatusBadge variant="neutral" showIcon={false}>
                {events.length} step{events.length === 1 ? "" : "s"}
              </StatusBadge>
            </div>
            {events.length === 0 ? (
              <p className="admin-user-investment-detail__empty">No status changes recorded yet.</p>
            ) : (
              <div>
                {events.map((event, index) => (
                  <JourneyEventRow
                    key={`${event.created_at ?? "event"}-${index}`}
                    event={event}
                    isLast={index === events.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AdminDetailDialog>
  );
}
