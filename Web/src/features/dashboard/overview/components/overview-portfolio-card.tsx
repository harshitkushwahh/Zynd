"use client";

import Link from "next/link";
import { PieChart, TrendingUp, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  OVERVIEW_PORTFOLIO_PREVIEW,
  type OverviewPortfolioPreview,
} from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { ZYND_CARD_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type OverviewPortfolioCardProps = {
  data?: OverviewPortfolioPreview;
  className?: string;
};

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-muted-foreground",
  );
}

function DetailCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative" | "muted";
  icon: typeof Wallet;
}) {
  return (
    <div className="min-w-0 rounded-[var(--radius-control)] border border-border/70 bg-muted/15 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3 shrink-0" strokeWidth={2.25} />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1.5 text-compact font-semibold tabular-nums tracking-tight",
          tone ? toneClass(tone) : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function OverviewPortfolioCard({
  data = OVERVIEW_PORTFOLIO_PREVIEW,
  className,
}: OverviewPortfolioCardProps) {
  const overview = copy.dashboard.overview;
  const totalReturn = formatSignedReturn(data.totalReturnPct);
  const dayChange = formatSignedReturn(data.dayChangePct);

  return (
    <section
      className={cn(
        ZYND_CARD_RADIUS_CLASS,
        "min-w-0 border border-border bg-card shadow-zynd-low",
        className,
      )}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PieChart className="size-3.5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p className="text-compact font-semibold text-foreground">{overview.portfolioTitle}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {overview.portfolioPreviewNote}
              </p>
            </div>
          </div>
          <Button
            variant="muted"
            size="sm"
            className="shrink-0"
            nativeButton={false}
            render={<Link href="/dashboard/mutual-funds" />}
          >
            {overview.portfolioExploreCta}
          </Button>
        </div>

        <div className="mt-4 rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3.5 py-3">
          <p className="text-[11px] text-muted-foreground">{overview.portfolioCurrentValue}</p>
          <p className="mt-1 text-[1.65rem] font-semibold tracking-tight tabular-nums text-foreground">
            {formatInr(data.currentValueInr)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
            <span className={cn("font-semibold tabular-nums", toneClass(totalReturn.tone))}>
              {formatInr(data.totalReturnInr)} ({totalReturn.text})
            </span>
            <span className="text-muted-foreground">·</span>
            <span className={cn("font-medium tabular-nums", toneClass(dayChange.tone))}>
              {dayChange.text} today · {formatInr(data.dayChangeInr)}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <DetailCard
            icon={Wallet}
            label={overview.portfolioInvested}
            value={formatInr(data.investedInr)}
          />
          <DetailCard
            icon={TrendingUp}
            label={overview.portfolioReturns}
            value={totalReturn.text}
            sub={formatInr(data.totalReturnInr)}
            tone={totalReturn.tone}
          />
          <DetailCard
            icon={TrendingUp}
            label={overview.portfolioDayChange}
            value={dayChange.text}
            sub={formatInr(data.dayChangeInr)}
            tone={dayChange.tone}
          />
        </div>
      </div>
    </section>
  );
}
