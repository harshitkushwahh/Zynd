"use client";

import { useMemo, useState, type LucideIcon, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, Check, Copy, Hash, Layers, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { UiMessage } from "@/components/ui/ui-message";
import { useRedemptionJourneyQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { portfolioHoldingDetailRedeemHref } from "@/features/dashboard/portfolio/lib/portfolio-holding-detail-data";
import {
  buildRedemptionJourneyView,
  type RedemptionJourneyDisplayStep,
} from "@/features/dashboard/portfolio/lib/portfolio-redeem-journey-copy";
import type { PortfolioRedeemUnitsRow } from "@/features/dashboard/portfolio/lib/portfolio-redeem-mapper";
import { portfolioHoldingAmcInitials } from "@/features/dashboard/portfolio/lib/portfolio-types";
import { MfOrderStatusBadge, mfOrderStatusVariant } from "@/features/invest/components/mf-order-status-badge";
import { formatDateTime, formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PortfolioRedeemUnitsJourneyDialogProps = {
  open: boolean;
  row: PortfolioRedeemUnitsRow | null;
  onOpenChange: (open: boolean) => void;
};

const DIALOG_CLOSE_MS = 320;
const DIALOG_SURFACE_CLASS = "overflow-hidden rounded-[var(--radius-card)] border border-border bg-card";
const SECTION_HEADER_CLASS = "border-b border-border bg-muted/20 px-4 py-3";

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
  const portfolioCopy = copy.dashboard.portfolio;

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
      label={portfolioCopy.redeemJourneyOrderId}
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
          {copied ? copy.transactions.journeyCopied : portfolioCopy.redeemJourneyCopyOrderId}
        </Button>
      }
    />
  );
}

function JourneyStepRow({ step, isLast }: { step: RedemptionJourneyDisplayStep; isLast: boolean }) {
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

function RedeemFundSummary({
  row,
  amountInr,
  status,
}: {
  row: PortfolioRedeemUnitsRow;
  amountInr: number;
  status?: string;
}) {
  return (
    <section className={DIALOG_SURFACE_CLASS}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted text-[11px] font-semibold text-muted-foreground">
              {portfolioHoldingAmcInitials(row.amcName)}
            </div>
            <div className="min-w-0">
              <p className="font-medium leading-snug text-foreground">{row.fundName}</p>
              <p className="mt-0.5 text-caption text-muted-foreground">{row.amcName}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-caption text-muted-foreground">{copy.transactions.tableAmount}</p>
            <p className="mt-0.5 text-body font-semibold tabular-nums text-foreground">{formatInr(amountInr)}</p>
          </div>
        </div>

        {status ? (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-caption font-medium text-muted-foreground">{copy.transactions.tableStatus}</span>
            <MfOrderStatusBadge status={status} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RedeemDetailTiles({
  orderId,
  placedAt,
  units,
}: {
  orderId: string;
  placedAt: string;
  units: number;
}) {
  const portfolioCopy = copy.dashboard.portfolio;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailTile icon={Layers} label={portfolioCopy.redeemJourneyUnitsLabel} value={units.toFixed(3)} />
      <DetailTile icon={CalendarClock} label={portfolioCopy.redeemJourneyPlacedOn} value={formatDateTime(placedAt)} />
      <OrderIdTile orderId={orderId} />
    </div>
  );
}

function RedeemJourneyTimelineSection({ journey }: { journey: ReturnType<typeof buildRedemptionJourneyView> }) {
  const portfolioCopy = copy.dashboard.portfolio;
  const isNegativeOutcome =
    journey.outcomeSummary?.toLowerCase().includes("cancel") ||
    journey.outcomeSummary?.toLowerCase().includes("fail");

  return (
    <section className={DIALOG_SURFACE_CLASS}>
      <div className={cn(SECTION_HEADER_CLASS, "flex items-center justify-between gap-3")}>
        <p className="text-compact font-semibold text-foreground">{portfolioCopy.redeemJourneyWhatHappened}</p>
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
          <p className="text-compact text-muted-foreground">{portfolioCopy.redeemJourneyEmpty}</p>
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

function NoActiveRedemptionPanel({ row }: { row: PortfolioRedeemUnitsRow }) {
  const portfolioCopy = copy.dashboard.portfolio;

  return (
    <div className="space-y-4">
      <RedeemFundSummary row={row} amountInr={row.redeemableValueInr} />
      <UiMessage variant="info" message={portfolioCopy.redeemJourneyNoActiveRedemption} className="mt-0" />
      <Button asChild className="w-full">
        <Link href={portfolioHoldingDetailRedeemHref(row.id)}>{portfolioCopy.redeemJourneyStartRedeem}</Link>
      </Button>
    </div>
  );
}

export function PortfolioRedeemUnitsJourneyDialog({
  open,
  row,
  onOpenChange,
}: PortfolioRedeemUnitsJourneyDialogProps) {
  const portfolioCopy = copy.dashboard.portfolio;
  const fpRedemptionId = row?.activeRedemptionId ?? null;
  const { journey, showSkeleton, errorMessage, fetchStatus } = useRedemptionJourneyQuery(
    open ? fpRedemptionId : null,
  );

  const orderJourney = useMemo(() => {
    if (!journey) return null;
    return {
      ...journey,
      view: buildRedemptionJourneyView(journey),
    };
  }, [journey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,44rem)] max-w-[min(100vw-2rem,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 items-center border-b border-border/60 px-5 py-4 text-center sm:px-6">
          <DialogTitle className="w-full text-center">{portfolioCopy.redeemUnitsJourneyTitle}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {row && showSkeleton ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : null}

          {row && errorMessage ? <UiMessage variant="error" message={errorMessage} className="mt-0" /> : null}

          {row && !fpRedemptionId && !showSkeleton && !errorMessage ? (
            <NoActiveRedemptionPanel row={row} />
          ) : null}

          {row && fpRedemptionId && !showSkeleton && !errorMessage && !journey && fetchStatus === "not_found" ? (
            <UiMessage variant="error" message={portfolioCopy.redeemJourneyLoadFailed} className="mt-0" />
          ) : null}

          {row && orderJourney && !showSkeleton && !errorMessage ? (
            <div className="space-y-4">
              <RedeemFundSummary row={row} amountInr={orderJourney.amountInr} status={orderJourney.status} />
              <RedeemDetailTiles
                orderId={orderJourney.orderId}
                placedAt={orderJourney.placedAt}
                units={orderJourney.units}
              />
              <RedeemJourneyTimelineSection journey={orderJourney.view} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DIALOG_CLOSE_MS as PORTFOLIO_REDEEM_JOURNEY_DIALOG_CLOSE_MS };
