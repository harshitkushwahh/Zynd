"use client";

import { useCallback, useMemo, useState, type UIEvent } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { FieldMessage } from "@/components/ui/ui-message";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { usePortfolioHoldingsQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import type { PortfolioHoldingResponse } from "@/features/dashboard/portfolio/lib/portfolio-api";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import { OverviewCompactCardHeader } from "@/features/dashboard/overview/components/overview-compact-card-header";
import { OVERVIEW_HOLDINGS_LOCKED_PREVIEW } from "@/features/dashboard/overview/lib/overview-locked-preview-data";
import {
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
  className?: string;
};

const HOLDING_CARD_HEIGHT_CLASS = "min-h-[4.5rem]";
const HOLDINGS_LIST_VIEWPORT_CLASS = "h-[14.5rem]";
const VISIBLE_HOLDINGS_COUNT = 3;

function mapPortfolioHoldingsToCardItems(
  holdings: PortfolioHoldingResponse[],
): OverviewHoldingCardItem[] {
  return holdings.map((holding) => ({
    id: holding.id,
    fundName: holding.fund_name,
    amcName: holding.amc_name ?? copy.mutualFunds.unknownAmc,
    amcLogoUrl: holding.amc_logo_url,
    investedInr: holding.current_value_inr,
    returnPct: holding.return_pct,
  }));
}

function HoldingRow({ holding, index }: { holding: OverviewHoldingCardItem; index: number }) {
  const overview = copy.dashboard.overview;
  const fundReturn = formatSignedReturn(holding.returnPct);
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
            holding.returnPct == null && styles.muted,
            fundReturn.tone === "positive" && styles.title,
            fundReturn.tone === "negative" && styles.negative,
            fundReturn.tone === "muted" && holding.returnPct != null && styles.muted,
          )}
        >
          {holding.returnPct == null ? "—" : fundReturn.text}
        </p>
        <p className={cn("mt-0.5 text-[9px] uppercase tracking-wide", styles.label)}>
          {overview.holdingsReturnLabel}
        </p>
      </div>
    </article>
  );
}

export function OverviewHoldingsCard({ className }: OverviewHoldingsCardProps) {
  const overview = copy.dashboard.overview;
  const { data, showSkeleton, errorMessage } = usePortfolioHoldingsQuery();
  const [showHeaderFade, setShowHeaderFade] = useState(false);

  const cardHoldings = useMemo(
    () => mapPortfolioHoldingsToCardItems(data?.holdings ?? []),
    [data?.holdings],
  );
  const isLocked = !showSkeleton && !errorMessage && cardHoldings.length === 0;

  const handleListScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setShowHeaderFade(event.currentTarget.scrollTop > HOLDINGS_HEADER_FADE_SCROLL_PX);
  }, []);

  const header = (
    <div
      className={cn(
        "relative shrink-0 px-4 pt-4 pb-2 sm:px-5 sm:pt-5",
        !isLocked && "z-10 bg-[var(--zynd-white)] dark:bg-card",
      )}
    >
      <OverviewCompactCardHeader
        title={overview.holdingsInvestmentsTitle}
        href="/dashboard/portfolio"
        ariaLabel={overview.holdingsExploreCta}
      />
      {!isLocked ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 -bottom-5 h-5 bg-gradient-to-b from-[var(--zynd-white)] via-[color-mix(in_srgb,var(--zynd-white)_92%,transparent)] to-transparent transition-opacity duration-200 ease-out dark:from-card dark:via-card/95",
            showHeaderFade ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </div>
  );

  const listBody = (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 px-2 pb-3 pt-1 sm:px-3",
        !isLocked && "relative z-0 overflow-y-auto overscroll-contain scroll-smooth [scrollbar-width:thin]",
        HOLDINGS_LIST_VIEWPORT_CLASS,
      )}
      onScroll={isLocked ? undefined : handleListScroll}
    >
      {showSkeleton
        ? Array.from({ length: VISIBLE_HOLDINGS_COUNT }).map((_, index) => (
            <Skeleton key={index} className="h-[4.5rem] rounded-[1.15rem]" />
          ))
        : null}
      {errorMessage ? (
        <div className="px-2 py-4">
          <FieldMessage variant="error" message={errorMessage} />
        </div>
      ) : null}
      {isLocked
        ? OVERVIEW_HOLDINGS_LOCKED_PREVIEW.map((holding, index) => (
            <HoldingRow key={holding.id} holding={holding} index={index} />
          ))
        : null}
      {!showSkeleton && !errorMessage
        ? cardHoldings.map((holding, index) => (
            <HoldingRow key={holding.id} holding={holding} index={index} />
          ))
        : null}
    </div>
  );

  return (
    <section
      className={cn(
        "flex min-h-[16.5rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card",
        className,
      )}
    >
      {header}
      {isLocked ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="pointer-events-none flex flex-1 select-none flex-col blur-[5px]">
            {listBody}
          </div>
          <OverviewLockedCardBackdrop />
          <OverviewLockedCardOverlay
            title={overview.holdingsInvestmentsTitle}
            subtitle={overview.holdingsEmpty}
          />
        </div>
      ) : (
        listBody
      )}
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
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-3.5" />
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
