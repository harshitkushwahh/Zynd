"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Copy } from "lucide-react";

import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  fetchMfOrderJourney,
  type MfOrder,
  type MfOrderJourneyResponse,
} from "@/features/invest/api/invest-api";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfOrderStatusBadge } from "@/features/invest/components/mf-order-status-badge";
import {
  MF_JOURNEY_DIALOG_BODY_SHELL_CLASS,
  MF_JOURNEY_DIALOG_GRID_CLASS,
  MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS,
  MfJourneyDialogSkeleton,
} from "@/features/invest/components/payment-dialog/mf-journey-dialog-skeleton";
import { buildOrderJourneyView, type JourneyDisplayStep } from "@/features/invest/lib/mf-order-journey-copy";
import { formatDateTime, formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfOrderJourneyDialogProps = {
  open: boolean;
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
};

function formatOrderType(orderType: string) {
  const normalized = orderType.trim().toUpperCase();
  if (normalized === "LUMPSUM") return copy.transactions.typeLumpsum;
  if (normalized === "SIP") return copy.transactions.typeSip;
  if (normalized === "REDEMPTION") return copy.transactions.typeRedemption;
  return orderType.replaceAll("_", " ");
}

function JourneyStepRow({ step, isLast }: { step: JourneyDisplayStep; isLast: boolean }) {
  const isFailed = step.badgeVariant === "destructive";
  const isComplete = step.isComplete;

  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-3">
      <div className="flex flex-col items-center self-stretch pt-1">
        <span
          className={cn(
            "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            isFailed
              ? "border-destructive/50 bg-destructive/10"
              : isComplete
                ? "border-success/50 bg-success/10"
                : "border-primary/30 bg-primary/10",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              isFailed ? "bg-destructive" : isComplete ? "bg-success" : "bg-primary",
            )}
          />
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
      </div>

      <div className={cn("min-w-0", !isLast && "pb-4")}>
        <p className="font-medium text-foreground">{step.title}</p>
        {step.description ? (
          <p className="mt-1.5 text-compact leading-relaxed text-muted-foreground">{step.description}</p>
        ) : null}
        <p className="mt-2 text-caption text-muted-foreground">
          {formatDateTime(step.event?.created_at)}
          <span className="mx-1.5 text-border">·</span>
          {step.actor}
        </p>
      </div>

      <div className={cn("flex shrink-0 justify-end pt-0.5", !isLast && "pb-4")}>
        <StatusBadge variant={step.badgeVariant} className="normal-case">
          {step.toStatus}
        </StatusBadge>
      </div>
    </div>
  );
}

function OrderJourneySummaryPanel({ order }: { order: MfOrder }) {
  const [copied, setCopied] = useState(false);
  const amcName = order.amc_name ?? copy.mutualFunds.unknownAmc;
  const orderTypeLabel = formatOrderType(order.order_type);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(order.order_id);
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
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <MfFundAmcAvatar
          amcLogoUrl={order.amc_logo_url}
          amcName={amcName}
          size="md"
          className="size-14 text-caption"
        />
        <p className="mt-4 text-body font-semibold leading-snug text-foreground">
          {order.product_name ?? copy.mutualFunds.unknownFund}
        </p>
        <p className="mt-1 text-caption text-muted-foreground">{amcName}</p>
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {copy.transactions.journeyPaymentType}
          </p>
          <p className="mt-1 text-compact font-semibold text-foreground">{orderTypeLabel}</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {copy.transactions.tableAmount}
          </p>
          <p className="mt-1 text-h4 font-semibold tabular-nums text-foreground">
            {formatInr(order.amount_inr)}
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {copy.transactions.journeyLatestStatus}
          </p>
          <div className="mt-2">
            <MfOrderStatusBadge status={order.status} fpState={order.fp_state} />
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {copy.transactions.journeyPlacedOn}
              </p>
              <p className="mt-1 text-compact font-medium text-foreground">
                {formatDateTime(order.created_at)}
              </p>
            </div>
            <CalendarClock className="size-4 shrink-0 text-muted-foreground/70" strokeWidth={2.25} />
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {copy.transactions.journeyOrderId}
              </p>
              <p className="mt-1 break-all font-mono text-caption leading-relaxed text-foreground">
                {order.order_id}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => void handleCopy()}
              aria-label={copy.transactions.journeyCopyOrderId}
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function OrderJourneyTimelinePanel({
  journey,
}: {
  journey: NonNullable<ReturnType<typeof buildOrderJourneyView>>;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col md:overflow-hidden">
      <div className="shrink-0 p-5 pb-0 sm:p-6 sm:pb-0">
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
      </div>

      <div
        className={cn(
          "px-5 pb-5 sm:px-6 sm:pb-6",
          MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS,
          "md:flex-1",
        )}
      >
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

export function MfOrderJourneyDialog({ open, orderId, onOpenChange }: MfOrderJourneyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MfOrderJourneyResponse | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchMfOrderJourney(orderId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || copy.transactions.journeyLoadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const journey = useMemo(
    () => (detail ? buildOrderJourneyView(detail.order, detail.events) : null),
    [detail],
  );

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.transactions.journeyTitle}
      maxWidth="xl"
      className="max-h-[min(90vh,44rem)] w-full max-w-[min(calc(100vw-2rem),60rem)]"
    >
      <div className={MF_JOURNEY_DIALOG_BODY_SHELL_CLASS}>
        {loading ? <MfJourneyDialogSkeleton variant="order" /> : null}

        {error ? (
          <div className="flex items-center p-5 sm:p-6">
            <FieldMessage variant="error" message={error} />
          </div>
        ) : null}

        {!loading && !error && detail && journey ? (
          <div
            className={cn(
              MF_JOURNEY_DIALOG_GRID_CLASS,
              "md:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]",
            )}
          >
            <OrderJourneySummaryPanel order={detail.order} />
            <OrderJourneyTimelinePanel journey={journey} />
          </div>
        ) : null}
      </div>
    </BrandDialog>
  );
}
