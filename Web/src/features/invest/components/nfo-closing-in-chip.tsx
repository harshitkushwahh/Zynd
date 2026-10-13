"use client";

import { AlertCircle, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  nfoCloseCountdown,
  nfoClosingUrgencyTier,
  nfoClosesInTimePart,
  type NfoClosingUrgencyTier,
} from "@/features/invest/lib/mf-nfo";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function countdownLabels() {
  return {
    closed: copy.mutualFunds.nfoClosingClosed,
    today: copy.mutualFunds.nfoClosingToday,
    oneDay: copy.mutualFunds.nfoClosingDay,
    days: (count: number) => copy.mutualFunds.nfoClosingDays.replace("{count}", String(count)),
    expiringSoon: copy.mutualFunds.nfoExpiringSoonBadge,
  };
}

const TIER_STYLE: Record<
  NfoClosingUrgencyTier,
  {
    shell: string;
    label: string;
    value: string;
    iconWrap: string;
    animateIcon?: boolean;
    ping?: boolean;
  }
> = {
  green: {
    shell: "bg-emerald-600 shadow-md shadow-emerald-950/25 ring-1 ring-emerald-400/35",
    label: "text-emerald-50/80",
    value: "text-white",
    iconWrap: "bg-white/15 text-white",
  },
  yellow: {
    shell: "bg-amber-400 shadow-md shadow-amber-950/15 ring-1 ring-amber-500/40",
    label: "text-amber-950/70",
    value: "text-amber-950",
    iconWrap: "bg-amber-950/10 text-amber-950",
    animateIcon: true,
  },
  red: {
    shell: "bg-red-600 shadow-lg shadow-red-950/35 ring-1 ring-red-400/40",
    label: "text-red-50/85",
    value: "text-white",
    iconWrap: "bg-white/15 text-white",
    animateIcon: true,
    ping: true,
  },
};

type NfoClosingInChipProps = {
  closeDate?: string | null;
  className?: string;
};

export function NfoClosingInChip({ closeDate, className }: NfoClosingInChipProps) {
  const [now, setNow] = useState(() => new Date());

  const countdown = useMemo(
    () => (closeDate ? nfoCloseCountdown(closeDate, countdownLabels(), now) : null),
    [closeDate, now],
  );

  const tier = countdown ? nfoClosingUrgencyTier(countdown) : null;

  useEffect(() => {
    if (!closeDate || tier !== "red") return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [closeDate, tier]);

  if (!countdown || !tier) return null;

  const timePart = nfoClosesInTimePart(countdown, now, {
    oneDay: copy.mutualFunds.nfoClosingDay,
    days: (count) => copy.mutualFunds.nfoClosingDays.replace("{count}", String(count)),
  });
  const closesInLine = copy.mutualFunds.nfoClosesTodayCountdown.replace("{time}", timePart);
  const style = TIER_STYLE[tier];
  const Icon = tier === "red" ? AlertCircle : Timer;

  return (
    <div
      role="status"
      aria-label={`${copy.mutualFunds.nfoClosingInLabel}. ${closesInLine}`}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl px-3.5 py-3",
        style.shell,
        className,
      )}
    >
      <span className={cn("relative flex size-10 shrink-0 items-center justify-center rounded-full", style.iconWrap)}>
        {style.ping ? (
          <span
            className="absolute inset-0 motion-safe:animate-ping rounded-full bg-white/25"
            aria-hidden
          />
        ) : null}
        <Icon
          className={cn(
            "relative size-[1.125rem]",
            style.animateIcon && tier === "red" && "motion-safe:animate-pulse",
            style.animateIcon && tier === "yellow" && "motion-safe:animate-nfo-timer-tick",
          )}
          strokeWidth={2.25}
          aria-hidden
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[11px] font-medium leading-tight", style.label)}>
          {copy.mutualFunds.nfoClosingInLabel}
        </p>
        <p className={cn("mt-0.5 truncate text-compact font-semibold tabular-nums leading-snug", style.value)}>
          {closesInLine}
        </p>
      </div>
    </div>
  );
}

/** Plain closing line for detail panel when outside the urgency window (e.g. 10+ days). */
export function nfoClosingInPlainValue(closeDate: string | null | undefined, now: Date = new Date()): string {
  if (!closeDate) return "—";
  const countdown = nfoCloseCountdown(closeDate, countdownLabels(), now);
  if (!countdown || countdown.phase === "closed") return copy.mutualFunds.nfoClosingClosed;
  if (nfoClosingUrgencyTier(countdown)) {
    const timePart = nfoClosesInTimePart(countdown, now, {
      oneDay: copy.mutualFunds.nfoClosingDay,
      days: (count) => copy.mutualFunds.nfoClosingDays.replace("{count}", String(count)),
    });
    return copy.mutualFunds.nfoClosesTodayCountdown.replace("{time}", timePart);
  }
  if (countdown.daysUntilClose != null && countdown.daysUntilClose > 0) {
    return copy.mutualFunds.nfoClosesTodayCountdown.replace(
      "{time}",
      copy.mutualFunds.nfoClosingDays.replace("{count}", String(countdown.daysUntilClose)),
    );
  }
  return countdown.closingInLabel;
}

export function useNfoClosingUrgencyTier(closeDate?: string | null) {
  const [now, setNow] = useState(() => new Date());
  const countdown = useMemo(
    () => (closeDate ? nfoCloseCountdown(closeDate, countdownLabels(), now) : null),
    [closeDate, now],
  );
  const tier = countdown ? nfoClosingUrgencyTier(countdown) : null;

  useEffect(() => {
    if (!closeDate || tier !== "red") return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [closeDate, tier]);

  return { countdown, tier, now };
}
