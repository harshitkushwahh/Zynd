"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, Check, Copy, Info, Layers } from "lucide-react";

import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { useRedemptionJourneyQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { portfolioHoldingDetailRedeemHref } from "@/features/dashboard/portfolio/lib/portfolio-holding-detail-data";
import {
  buildRedemptionJourneyView,
  type RedemptionJourneyDisplayStep,
} from "@/features/dashboard/portfolio/lib/portfolio-redeem-journey-copy";
import type { PortfolioRedeemUnitsRow } from "@/features/dashboard/portfolio/lib/portfolio-redeem-mapper";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfOrderStatusBadge, mfOrderStatusVariant } from "@/features/invest/components/mf-order-status-badge";
import {
  MF_JOURNEY_DIALOG_BODY_SHELL_CLASS,
  MF_JOURNEY_DIALOG_GRID_CLASS,
  MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS,
  MfJourneyDialogSkeleton,
} from "@/features/invest/components/payment-dialog/mf-journey-dialog-skeleton";
import { formatDateTime, formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PortfolioRedeemUnitsJourneyDialogProps = {
  open: boolean;
  row: PortfolioRedeemUnitsRow | null;
  onOpenChange: (open: boolean) => void;
};

const DIALOG_CLOSE_MS = 320;

function SummaryCard({
  label,
  children,
  action,
  className,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-muted/20 p-3.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {action}
      </div>
      <div className="mt-1">{children}</div>
    </div>
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

function RedeemHoldingSummaryPanel({
  row,
  mode,
  amountInr,
  status,
  orderId,
  placedAt,
  units,
}: {
  row: PortfolioRedeemUnitsRow;
  mode: "idle" | "active";
  amountInr?: number;
  status?: string;
  orderId?: string;
  placedAt?: string;
  units?: number;
}) {
  const portfolioCopy = copy.dashboard.portfolio;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!orderId) return;
    try {
      await navigator.clipboard.writeText(orderId);
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
          amcLogoUrl={row.amcLogoUrl}
          amcName={row.amcName}
          size="md"
          className="size-14 text-caption"
        />
        <p className="mt-4 text-body font-semibold leading-snug text-foreground">{row.fundName}</p>
        <p className="mt-1 text-caption text-muted-foreground">{row.amcName}</p>
      </div>

      <div className="mt-5 space-y-3">
        {mode === "idle" ? (
          <>
            <SummaryCard label={portfolioCopy.redeemUnitsUnits}>
              <p className="text-h4 font-semibold tabular-nums text-foreground">
                {row.redeemableUnits.toFixed(3)}
              </p>
            </SummaryCard>
            <SummaryCard label={portfolioCopy.redeemUnitsValue}>
              <p className="text-h4 font-semibold tabular-nums text-foreground">
                {formatInr(row.redeemableValueInr)}
              </p>
            </SummaryCard>
          </>
        ) : (
          <>
            <SummaryCard label={copy.transactions.tableAmount}>
              <p className="text-h4 font-semibold tabular-nums text-foreground">{formatInr(amountInr ?? 0)}</p>
            </SummaryCard>

            {status ? (
              <SummaryCard label={copy.transactions.tableStatus}>
                <MfOrderStatusBadge status={status} />
              </SummaryCard>
            ) : null}

            {units != null ? (
              <SummaryCard
                label={portfolioCopy.redeemJourneyUnitsLabel}
                action={<Layers className="size-4 shrink-0 text-muted-foreground/70" strokeWidth={2.25} />}
              >
                <p className="text-compact font-semibold tabular-nums text-foreground">{units.toFixed(3)}</p>
              </SummaryCard>
            ) : null}

            {placedAt ? (
              <SummaryCard
                label={portfolioCopy.redeemJourneyPlacedOn}
                action={<CalendarClock className="size-4 shrink-0 text-muted-foreground/70" strokeWidth={2.25} />}
              >
                <p className="text-compact font-medium text-foreground">{formatDateTime(placedAt)}</p>
              </SummaryCard>
            ) : null}

            {orderId ? (
              <SummaryCard
                label={portfolioCopy.redeemJourneyOrderId}
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => void handleCopy()}
                    aria-label={portfolioCopy.redeemJourneyCopyOrderId}
                  >
                    {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  </Button>
                }
              >
                <p className="break-all font-mono text-caption leading-relaxed text-foreground">{orderId}</p>
              </SummaryCard>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

function RedeemNoActivePanel({ row, message }: { row: PortfolioRedeemUnitsRow; message: string }) {
  const portfolioCopy = copy.dashboard.portfolio;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col md:overflow-hidden">
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-6 sm:py-12",
          MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS,
        )}
      >
        <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground">
            <Info className="size-5" strokeWidth={2.25} aria-hidden />
          </div>
          <p className="mt-4 text-compact leading-relaxed text-muted-foreground">{message}</p>
          <Button
            className="mt-6 w-full"
            nativeButton={false}
            render={<Link href={portfolioHoldingDetailRedeemHref(row.id)} />}
          >
            {portfolioCopy.redeemJourneyStartRedeem}
          </Button>
        </div>
      </div>
    </section>
  );
}

function RedeemJourneyTimelinePanel({
  journey,
}: {
  journey: ReturnType<typeof buildRedemptionJourneyView>;
}) {
  const portfolioCopy = copy.dashboard.portfolio;
  const isNegativeOutcome =
    journey.outcomeSummary?.toLowerCase().includes("cancel") ||
    journey.outcomeSummary?.toLowerCase().includes("fail");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col md:overflow-hidden">
      <div className="shrink-0 p-5 pb-0 sm:p-6 sm:pb-0">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 pr-2">
          <p className="min-w-0 flex-1 text-compact font-semibold text-foreground">
            {portfolioCopy.redeemJourneyWhatHappened}
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
          "space-y-4 px-5 pb-5 sm:px-6 sm:pb-6",
          MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS,
          "md:flex-1",
        )}
      >
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

  const showIdleState = Boolean(row && !fpRedemptionId && !showSkeleton && !errorMessage);
  const showActiveState = Boolean(row && orderJourney && !showSkeleton && !errorMessage);

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={portfolioCopy.redeemUnitsJourneyTitle}
      maxWidth="xl"
      className="max-h-[min(90vh,44rem)] w-full max-w-[min(calc(100vw-2rem),60rem)]"
    >
      <>
        <div className={MF_JOURNEY_DIALOG_BODY_SHELL_CLASS}>
          {row && showSkeleton ? <MfJourneyDialogSkeleton variant="order" /> : null}

          {row && errorMessage ? (
            <div className="flex items-center p-5 sm:p-6">
              <FieldMessage variant="error" message={errorMessage} />
            </div>
          ) : null}

          {showIdleState && row ? (
            <div
              className={cn(
                MF_JOURNEY_DIALOG_GRID_CLASS,
                "md:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]",
              )}
            >
              <RedeemHoldingSummaryPanel row={row} mode="idle" />
              <RedeemNoActivePanel row={row} message={portfolioCopy.redeemJourneyNoActiveRedemption} />
            </div>
          ) : null}

          {row && fpRedemptionId && !showSkeleton && !errorMessage && !journey && fetchStatus === "not_found" ? (
            <div className="flex items-center p-5 sm:p-6">
              <FieldMessage variant="error" message={portfolioCopy.redeemJourneyLoadFailed} />
            </div>
          ) : null}

          {showActiveState && row && orderJourney ? (
            <div
              className={cn(
                MF_JOURNEY_DIALOG_GRID_CLASS,
                "md:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]",
              )}
            >
              <RedeemHoldingSummaryPanel
                row={row}
                mode="active"
                amountInr={orderJourney.amountInr}
                status={orderJourney.status}
                orderId={orderJourney.orderId}
                placedAt={orderJourney.placedAt}
                units={orderJourney.units}
              />
              <RedeemJourneyTimelinePanel journey={orderJourney.view} />
            </div>
          ) : null}
        </div>
      </>
    </BrandDialog>
  );
}

export { DIALOG_CLOSE_MS as PORTFOLIO_REDEEM_JOURNEY_DIALOG_CLOSE_MS };
