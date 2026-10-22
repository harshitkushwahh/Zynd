"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { Calendar, CreditCard, Sun } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type MfCartTab = "lumpsum" | "monthly" | "daily";

function tabIndex(tab: MfCartTab): number {
  if (tab === "monthly") return 0;
  if (tab === "daily") return 1;
  return 2;
}

const tabButtonClass =
  "relative z-10 inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[11px] font-medium transition-[color,opacity] duration-200 ease-out sm:px-3 sm:text-compact";

type MfCartTabToggleProps = {
  tab: MfCartTab;
  onChange: (tab: MfCartTab) => void;
  lumpsumCount: number;
  monthlyCount: number;
  dailyCount: number;
};

function formatCount(count: number) {
  return count > 9 ? "9+" : String(count);
}

export function MfCartTabToggle({
  tab,
  onChange,
  lumpsumCount,
  monthlyCount,
  dailyCount,
}: MfCartTabToggleProps) {
  const reduceMotion = useReducedMotion();
  const [pendingTab, setPendingTab] = useState<MfCartTab | null>(null);

  useLayoutEffect(() => {
    if (pendingTab !== null && tab === pendingTab) {
      setPendingTab(null);
    }
  }, [pendingTab, tab]);

  const selected = pendingTab ?? tab;
  const selectedIndex = tabIndex(selected);

  const pillTransition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 520, damping: 38, mass: 0.75 },
    [reduceMotion],
  );

  function selectTab(next: MfCartTab) {
    if (selected === next) return;
    setPendingTab(next);
    onChange(next);
  }

  const counts = {
    monthly: monthlyCount,
    daily: dailyCount,
    lumpsum: lumpsumCount,
  };

  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.cartTitle}
      className="relative grid max-w-xl min-w-0 flex-1 grid-cols-3 gap-0 rounded-full border border-border/80 bg-muted/20 p-0.5"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-foreground shadow-zynd-low will-change-transform"
        style={{ width: "calc((100% - 0.25rem) / 3)" }}
        initial={false}
        animate={{ x: `${selectedIndex * 100}%` }}
        transition={pillTransition}
      />

      <button
        type="button"
        role="tab"
        aria-selected={selected === "monthly"}
        onClick={() => selectTab("monthly")}
        className={cn(
          tabButtonClass,
          selected === "monthly" ? "text-background" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Calendar className="size-3.5 shrink-0 opacity-90" aria-hidden />
        <span>{copy.mutualFunds.paymentCardSipFrequencyMonthly}</span>
        <span
          className={cn(
            "flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            selected === "monthly" ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
          )}
        >
          {formatCount(counts.monthly)}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={selected === "daily"}
        onClick={() => selectTab("daily")}
        className={cn(
          tabButtonClass,
          selected === "daily" ? "text-background" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sun className="size-3.5 shrink-0 opacity-90" aria-hidden />
        <span>{copy.mutualFunds.paymentCardSipFrequencyDaily}</span>
        <span
          className={cn(
            "flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            selected === "daily" ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
          )}
        >
          {formatCount(counts.daily)}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={selected === "lumpsum"}
        onClick={() => selectTab("lumpsum")}
        className={cn(
          tabButtonClass,
          selected === "lumpsum" ? "text-background" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <CreditCard className="size-3.5 shrink-0 opacity-90" aria-hidden />
        <span>{copy.mutualFunds.paymentCardOneTime}</span>
        <span
          className={cn(
            "flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            selected === "lumpsum" ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
          )}
        >
          {formatCount(counts.lumpsum)}
        </span>
      </button>
    </div>
  );
}
