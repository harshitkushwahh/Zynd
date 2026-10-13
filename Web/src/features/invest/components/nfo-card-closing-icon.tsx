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

function useNfoCardClosingUrgency(closeDate?: string | null) {
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

  const ariaLabel =
    countdown && tier
      ? copy.mutualFunds.nfoClosesTodayCountdown.replace(
          "{time}",
          nfoClosesInTimePart(countdown, now, {
            oneDay: copy.mutualFunds.nfoClosingDay,
            days: (count) => copy.mutualFunds.nfoClosingDays.replace("{count}", String(count)),
          }),
        )
      : undefined;

  return { tier, ariaLabel };
}

function UrgencyIcon({ tier }: { tier: NfoClosingUrgencyTier }) {
  if (tier === "red") {
    return (
      <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden>
        <span className="absolute size-4 motion-safe:animate-ping rounded-full bg-red-500/45" />
        <AlertCircle className="relative size-4 text-red-600 motion-safe:animate-pulse dark:text-red-500" strokeWidth={2.25} />
      </span>
    );
  }

  return (
    <Timer
      className="size-4 shrink-0 text-amber-600 motion-safe:animate-nfo-timer-tick dark:text-amber-500"
      strokeWidth={2.25}
      aria-hidden
    />
  );
}

const PERIOD_TEXT_CLASS: Record<NfoClosingUrgencyTier, string> = {
  green: "text-amber-600 dark:text-amber-500",
  yellow: "text-amber-600 dark:text-amber-500",
  red: "text-red-600 dark:text-red-500",
};

type NfoCardSubscriptionPeriodValueProps = {
  closeDate?: string | null;
  period: string;
  className?: string;
};

/** Icon + subscription dates on NFO browse cards (amber when expiring, red on close day). */
export function NfoCardSubscriptionPeriodValue({
  closeDate,
  period,
  className,
}: NfoCardSubscriptionPeriodValueProps) {
  const { tier, ariaLabel } = useNfoCardClosingUrgency(closeDate);

  return (
    <div
      className={cn("mt-0.5 flex min-w-0 items-center gap-1.5", className)}
      role={tier ? "status" : undefined}
      aria-label={tier ? ariaLabel : undefined}
    >
      {tier ? <UrgencyIcon tier={tier} /> : null}
      <p
        className={cn(
          "min-w-0 truncate text-compact font-semibold tabular-nums",
          tier ? PERIOD_TEXT_CLASS[tier] : "text-foreground",
        )}
      >
        {period}
      </p>
    </div>
  );
}
