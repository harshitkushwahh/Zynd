"use client";

import { useCallback, useState, type UIEvent } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import {
  OVERVIEW_HOLDINGS_CARD_PREVIEW,
  truncateHoldingFundName,
  type OverviewHoldingCardItem,
} from "@/features/dashboard/overview/lib/overview-holdings-preview";
import {
  OVERVIEW_BRAND_CARD_STYLES,
  resolveOverviewBrandCardTone,
} from "@/features/dashboard/overview/lib/overview-brand-card-styles";
import { formatSignedReturn } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const HOLDINGS_HEADER_FADE_SCROLL_PX = 6;

type OverviewHoldingsCardProps = {
  holdings?: readonly OverviewHoldingCardItem[];
  className?: string;
};

const HOLDING_CARD_HEIGHT_CLASS = "min-h-[4.5rem]";
const HOLDINGS_LIST_VIEWPORT_CLASS = "h-[14.5rem]";
const VISIBLE_HOLDINGS_COUNT = 3;

function HoldingRow({ holding, index }: { holding: OverviewHoldingCardItem; index: number }) {
  const overview = copy.dashboard.overview;
  const monthReturn = formatSignedReturn(holding.monthReturnPct);
  const styles = OVERVIEW_BRAND_CARD_STYLES[resolveOverviewBrandCardTone(index)];

  return (
    <article
      className={cn(
        "flex items-center justify-between gap-3 rounded-[1.15rem] px-3 py-3 shadow-zynd-low",
        HOLDING_CARD_HEIGHT_CLASS,
        styles.card,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <MfFundAmcAvatar
          amcLogoUrl={holding.amcLogoUrl}
          amcName={holding.amcName}
          size="sm"
          className={cn("rounded-full", styles.avatar)}
        />
        <div className="min-w-0">
          <p className={cn("truncate text-compact font-semibold", styles.title)}>
            {truncateHoldingFundName(holding.fundName)}
          </p>
          <p className={cn("mt-0.5 truncate text-[11px]", styles.muted)}>{holding.amcName}</p>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-compact font-semibold tabular-nums",
            monthReturn.tone === "positive" && styles.title,
            monthReturn.tone === "negative" && styles.negative,
            monthReturn.tone === "muted" && styles.muted,
          )}
        >
          {monthReturn.text}
        </p>
        <p className={cn("mt-0.5 text-[9px] uppercase tracking-wide", styles.label)}>
          {overview.holdingsLastMonthLabel}
        </p>
      </div>
    </article>
  );
}

export function OverviewHoldingsCard({
  holdings = OVERVIEW_HOLDINGS_CARD_PREVIEW,
  className,
}: OverviewHoldingsCardProps) {
  const overview = copy.dashboard.overview;
  const [showHeaderFade, setShowHeaderFade] = useState(false);

  const handleListScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setShowHeaderFade(event.currentTarget.scrollTop > HOLDINGS_HEADER_FADE_SCROLL_PX);
  }, []);

  return (
    <section
      className={cn(
        "flex min-h-[16.5rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card",
        className,
      )}
    >
      <div className="relative z-10 shrink-0 bg-[var(--zynd-white)] px-4 pt-4 dark:bg-card sm:px-5 sm:pt-5">
        <div className="flex items-center justify-between gap-3 pb-2">
          <h2 className="text-compact font-semibold text-foreground">{overview.holdingsInvestmentsTitle}</h2>
          <Link
            href="/dashboard/mutual-funds"
            aria-label={overview.holdingsExploreCta}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <ArrowUpRight className="size-4" strokeWidth={2.25} />
          </Link>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 -bottom-5 h-5 bg-gradient-to-b from-[var(--zynd-white)] via-[color-mix(in_srgb,var(--zynd-white)_92%,transparent)] to-transparent transition-opacity duration-200 ease-out dark:from-card dark:via-card/95",
            showHeaderFade ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <div
        className={cn(
          "relative z-0 flex shrink-0 flex-col gap-2 overflow-y-auto overscroll-contain scroll-smooth px-2 pb-3 pt-1 sm:px-3 [scrollbar-width:thin]",
          HOLDINGS_LIST_VIEWPORT_CLASS,
        )}
        onScroll={handleListScroll}
      >
        {holdings.map((holding, index) => (
          <HoldingRow key={holding.id} holding={holding} index={index} />
        ))}
      </div>
    </section>
  );
}

export function OverviewHoldingsCardSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "flex min-h-[16.5rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <div
        className={cn(
          "flex flex-col gap-2 overflow-hidden px-2 pb-3 pt-2 sm:px-3",
          HOLDINGS_LIST_VIEWPORT_CLASS,
        )}
      >
        {Array.from({ length: VISIBLE_HOLDINGS_COUNT }).map((_, index) => (
          <Skeleton key={index} className="h-[4.5rem] rounded-[1.15rem]" />
        ))}
      </div>
    </section>
  );
}
