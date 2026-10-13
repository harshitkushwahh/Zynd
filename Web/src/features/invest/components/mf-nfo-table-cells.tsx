"use client";

import { memo, useEffect, useMemo, useState } from "react";

import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import {
  MfFundCategoryBadge,
  resolveMfFundCategoryKind,
} from "@/features/invest/components/mf-fund-category-badge";
import { displayCategoryLabel } from "@/features/invest/lib/mf-fund-ranking";
import {
  nfoCloseCountdown,
  nfoClosingUrgencyTier,
  nfoClosesInTimePart,
  type NfoCloseCountdown,
  type NfoClosingUrgencyTier,
} from "@/features/invest/lib/mf-nfo";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type NfoBadgeTone = NfoClosingUrgencyTier | "grey";

const BADGE_TONE_CLASS: Record<
  NfoBadgeTone,
  { shell: string; text: string; dot: string; blink: boolean }
> = {
  green: {
    shell: "bg-emerald-100 ring-1 ring-emerald-200/80 dark:bg-emerald-950/50 dark:ring-emerald-800/50",
    text: "text-emerald-800 dark:text-emerald-300",
    dot: "bg-emerald-500",
    blink: false,
  },
  yellow: {
    shell: "bg-amber-100 ring-1 ring-amber-200/80 dark:bg-amber-950/45 dark:ring-amber-800/45",
    text: "text-amber-900 dark:text-amber-300",
    dot: "bg-amber-500",
    blink: true,
  },
  red: {
    shell: "bg-red-100 ring-1 ring-red-200/80 dark:bg-red-950/45 dark:ring-red-800/45",
    text: "text-red-800 dark:text-red-300",
    dot: "bg-red-500",
    blink: true,
  },
  grey: {
    shell: "bg-muted/70 ring-1 ring-border/60",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/55",
    blink: false,
  },
};

function countdownLabels() {
  return {
    closed: "",
    today: "",
    oneDay: copy.mutualFunds.nfoClosingDay,
    days: (count: number) => copy.mutualFunds.nfoClosingDays.replace("{count}", String(count)),
    expiringSoon: "",
  };
}

function opensInBadgeText(days: number | null): string | null {
  if (days == null) return null;
  if (days <= 0) return copy.mutualFunds.nfoOpensToday;
  if (days === 1) return copy.mutualFunds.nfoOpensInOneDay;
  return copy.mutualFunds.nfoOpensInDays.replace("{count}", String(days));
}

function offerStatusBadgeText(countdown: NfoCloseCountdown, timePart: string): string {
  if (countdown.phase === "closes_today") {
    return `${copy.mutualFunds.nfoClosingInLabel} ${timePart}`;
  }
  return copy.mutualFunds.nfoClosesTodayCountdown.replace("{time}", timePart);
}

function daysUntilDate(dateStr: string | null | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  const target = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function NfoTimeBadge({ text, tone }: { text: string; tone: NfoBadgeTone }) {
  const style = BADGE_TONE_CLASS[tone];

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold leading-snug",
        style.shell,
        style.text,
      )}
    >
      <span className="relative flex size-2 shrink-0 items-center justify-center" aria-hidden>
        {style.blink ? (
          <span
            className={cn("absolute inset-0 motion-safe:animate-ping rounded-full opacity-60", style.dot)}
          />
        ) : null}
        <span className={cn("relative size-2 rounded-full", style.dot, style.blink && "motion-safe:animate-pulse")} />
      </span>
      <span className="min-w-0 truncate leading-snug tabular-nums">{text}</span>
    </span>
  );
}

export const NfoOfferStatusCell = memo(function NfoOfferStatusCell({
  fund,
  now: nowProp,
}: {
  fund: InvestFundSummary;
  now: Date;
}) {
  const [now, setNow] = useState(nowProp);

  useEffect(() => {
    setNow(nowProp);
  }, [nowProp]);

  const closeDate = fund.nfo?.subscription_close_date;
  const status = (fund.nfo?.status ?? "").toUpperCase();

  const countdown = useMemo(
    () => (closeDate ? nfoCloseCountdown(closeDate, countdownLabels(), now) : null),
    [closeDate, now],
  );

  const tier = countdown ? nfoClosingUrgencyTier(countdown) : null;

  useEffect(() => {
    if (countdown?.phase !== "closes_today") return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [countdown?.phase]);

  if (status === "UPCOMING") {
    const text = opensInBadgeText(daysUntilDate(fund.nfo?.subscription_open_date, now));
    if (!text) return <span className="text-caption text-muted-foreground">—</span>;
    return <NfoTimeBadge text={text} tone="grey" />;
  }

  if (!countdown || countdown.phase === "closed") {
    return <span className="text-caption text-muted-foreground">—</span>;
  }

  const timePart = nfoClosesInTimePart(countdown, now, {
    oneDay: copy.mutualFunds.nfoClosingDay,
    days: (count) => copy.mutualFunds.nfoClosingDays.replace("{count}", String(count)),
  });

  const badgeTone: NfoBadgeTone = tier ?? "grey";
  const badgeText = offerStatusBadgeText(countdown, timePart);

  return <NfoTimeBadge text={badgeText} tone={badgeTone} />;
});

export function NfoCategoryCell({ fund }: { fund: InvestFundSummary }) {
  const categoryLabel = displayCategoryLabel(fund);
  const categoryKind = resolveMfFundCategoryKind(categoryLabel);

  if (!categoryLabel) {
    return <span className="text-caption text-muted-foreground">—</span>;
  }
  if (categoryKind) {
    return (
      <MfFundCategoryBadge kind={categoryKind} label={categoryLabel} showLabel showIcon={false} />
    );
  }
  return <span className="text-caption text-muted-foreground">{categoryLabel}</span>;
}
