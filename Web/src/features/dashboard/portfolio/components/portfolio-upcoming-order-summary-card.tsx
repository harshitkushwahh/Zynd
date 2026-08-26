"use client";

import { useState } from "react";
import { CalendarClock, Check, Copy, Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MfOrder } from "@/features/invest/api/invest-api";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfOrderStatusBadge } from "@/features/invest/components/mf-order-status-badge";
import { formatDateTime, formatInr } from "@/features/invest/lib/mf-format";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function formatOrderType(orderType: string) {
  const normalized = orderType.trim().toUpperCase();
  if (normalized === "LUMPSUM") return copy.transactions.typeLumpsum;
  if (normalized === "SIP") return copy.transactions.typeSip;
  if (normalized === "REDEMPTION") return copy.transactions.typeRedemption;
  return orderType.replaceAll("_", " ");
}

type PortfolioUpcomingOrderSummaryCardProps = {
  order: MfOrder;
  className?: string;
  onViewJourney?: () => void;
};

export function PortfolioUpcomingOrderSummaryCard({
  order,
  className,
  onViewJourney,
}: PortfolioUpcomingOrderSummaryCardProps) {
  const [copied, setCopied] = useState(false);
  const amcName = order.amc_name ?? copy.mutualFunds.unknownAmc;
  const portfolioCopy = copy.dashboard.portfolio;

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
    <section
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <MfFundAmcAvatar
            amcLogoUrl={order.amc_logo_url}
            amcName={amcName}
            size="md"
            className="size-12 shrink-0 rounded-[var(--radius-control)]"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {copy.dashboard.overview.holdingsUpcomingLabel}
            </p>
            <h1 className="mt-1 text-body font-semibold leading-snug text-foreground">
              {order.product_name ?? copy.mutualFunds.unknownFund}
            </h1>
            <p className="mt-1 text-caption text-muted-foreground">{amcName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onViewJourney ? (
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label={portfolioCopy.holdingUpcomingViewJourney}
                onClick={onViewJourney}
              >
                <Route className="size-4" strokeWidth={2.25} aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="top" align="end">
                {portfolioCopy.holdingUpcomingViewJourney}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <MfOrderStatusBadge status={order.status} fpState={order.fp_state} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.15rem] border border-border/60 bg-muted/20 p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {copy.transactions.journeyPaymentType}
          </p>
          <p className="mt-1 text-compact font-semibold text-foreground">
            {formatOrderType(order.order_type)}
          </p>
        </div>

        <div className="rounded-[1.15rem] border border-border/60 bg-muted/20 p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {copy.transactions.tableAmount}
          </p>
          <p className="mt-1 text-h4 font-semibold tabular-nums text-foreground">
            {formatInr(order.amount_inr)}
          </p>
        </div>

        <div className="rounded-[1.15rem] border border-border/60 bg-muted/20 p-3.5">
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

        <div className="rounded-[1.15rem] border border-border/60 bg-muted/20 p-3.5">
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
    </section>
  );
}
