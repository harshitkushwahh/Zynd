"use client";

import { useEffect, useMemo, useState, type LucideIcon, type ReactNode } from "react";
import { CalendarClock, Check, Copy, Hash, Loader2, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import {
  fetchMfOrderJourney,
  type MfOrder,
  type MfOrderJourneyResponse,
} from "@/features/invest/api/invest-api";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfOrderStatusBadge, mfOrderStatusVariant } from "@/features/invest/components/mf-order-status-badge";
import { MfPaymentCheckoutDetailsSkeleton } from "@/features/invest/components/payment-dialog/mf-payment-checkout-details-skeleton";
import { buildOrderJourneyView, type JourneyDisplayStep } from "@/features/invest/lib/mf-order-journey-copy";
import { formatDateTime, formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfOrderJourneyDialogProps = {
  open: boolean;
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
};

const DIALOG_SURFACE_CLASS = "overflow-hidden rounded-[var(--radius-card)] border border-border bg-card";
const SECTION_HEADER_CLASS = "border-b border-border bg-muted/20 px-4 py-3";

function formatOrderType(orderType: string) {
  const normalized = orderType.trim().toUpperCase();
  if (normalized === "LUMPSUM") return copy.transactions.typeLumpsum;
  if (normalized === "SIP") return copy.transactions.typeSip;
  if (normalized === "REDEMPTION") return copy.transactions.typeRedemption;
  return orderType.replaceAll("_", " ");
}

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

function OrderIdTile({ orderId }: { orderId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <DetailTile
      icon={Hash}
      label={copy.transactions.journeyOrderId}
      value={orderId}
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
          {copied ? copy.transactions.journeyCopied : copy.transactions.journeyCopyOrderId}
        </Button>
      }
    />
  );
}

function JourneyStepRow({ step, isLast }: { step: JourneyDisplayStep; isLast: boolean }) {
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
          variant={isTerminal ? "destructive" : mfOrderStatusVariant(step.event.to_status)}
          className="normal-case"
        >
          {step.toStatus}
        </StatusBadge>
      </div>
    </div>
  );
}

function OrderFundSummary({ order }: { order: MfOrder }) {
  const amcName = order.amc_name ?? copy.mutualFunds.unknownAmc;

  return (
    <section className={DIALOG_SURFACE_CLASS}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <MfFundAmcAvatar amcLogoUrl={order.amc_logo_url} amcName={amcName} size="md" className="mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium leading-snug text-foreground">
                {order.product_name ?? copy.mutualFunds.unknownFund}
              </p>
              <p className="mt-0.5 text-caption text-muted-foreground">{amcName}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-caption text-muted-foreground">{copy.transactions.tableAmount}</p>
            <p className="mt-0.5 text-body font-semibold tabular-nums text-foreground">
              {formatInr(order.amount_inr)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-caption font-medium text-muted-foreground">{copy.transactions.tableStatus}</span>
          <MfOrderStatusBadge status={order.status} />
        </div>
      </div>
    </section>
  );
}

function OrderDetailTiles({ order }: { order: MfOrder }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailTile
        icon={Wallet}
        label={copy.transactions.journeyPaymentType}
        value={formatOrderType(order.order_type)}
      />
      <DetailTile
        icon={CalendarClock}
        label={copy.transactions.journeyPlacedOn}
        value={formatDateTime(order.created_at)}
      />
      <OrderIdTile orderId={order.order_id} />
    </div>
  );
}

function JourneyTimelineSection({
  journey,
}: {
  journey: NonNullable<ReturnType<typeof buildOrderJourneyView>>;
}) {
  const isNegativeOutcome =
    journey.outcomeSummary?.toLowerCase().includes("cancel") ||
    journey.outcomeSummary?.toLowerCase().includes("fail");

  return (
    <section className={DIALOG_SURFACE_CLASS}>
      <div className={cn(SECTION_HEADER_CLASS, "flex items-center justify-between gap-3")}>
        <p className="text-compact font-semibold text-foreground">{copy.transactions.journeyWhatHappened}</p>
        {journey.steps.length > 0 ? (
          <StatusBadge variant="neutral" showIcon={false} className="shrink-0 whitespace-nowrap">
            {journey.steps.length} step{journey.steps.length === 1 ? "" : "s"}
          </StatusBadge>
        ) : null}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {journey.outcomeSummary ? (
          <UiMessage
            variant={isNegativeOutcome ? "error" : "info"}
            message={journey.outcomeSummary}
            className="mt-0"
          />
        ) : null}

        {journey.steps.length === 0 ? (
          <p className="text-compact text-muted-foreground">{copy.transactions.journeyEmpty}</p>
        ) : (
          <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-4 sm:px-4">
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

const DIALOG_CLOSE_MS = 320;

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

  useEffect(() => {
    if (open) return;

    const timer = window.setTimeout(() => {
      setDetail(null);
      setError(null);
      setLoading(false);
    }, DIALOG_CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [open]);

  const journey = useMemo(
    () => (detail ? buildOrderJourneyView(detail.order, detail.events) : null),
    [detail],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,44rem)] max-w-[min(100vw-2rem,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 items-center border-b border-border/60 px-5 py-4 text-center sm:px-6">
          <DialogTitle className="w-full text-center">{copy.transactions.journeyTitle}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-2 text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {copy.transactions.journeyLoading}
              </div>
              <MfPaymentCheckoutDetailsSkeleton />
            </div>
          ) : null}

          {error ? <FieldMessage variant="error" message={error} /> : null}

          {!loading && !error && detail && journey ? (
            <div className="space-y-4">
              <OrderFundSummary order={detail.order} />
              <OrderDetailTiles order={detail.order} />
              <JourneyTimelineSection journey={journey} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
