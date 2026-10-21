"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { Calendar, CreditCard, Sun } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import { isDailySipFrequency, type SipFrequency } from "@/features/invest/lib/mf-sip-frequency";
import { MfFolioNominationInfoButton } from "@/features/invest/components/mf-folio-nomination-info";

type InvestMode = "sip" | "lumpsum";
export type MfInvestTab = "monthly" | "daily" | "lumpsum";

export type MfInvestModeToggleProps = {
  mode: InvestMode;
  sipFrequency: SipFrequency;
  onTabSelect: (tab: MfInvestTab) => void;
  monthlySipAllowed: boolean;
  dailySipAllowed: boolean;
  lumpsumAllowed?: boolean;
  disabled?: boolean;
  showFolioNominationInfo?: boolean;
};

function activeTab(mode: InvestMode, sipFrequency: SipFrequency): MfInvestTab {
  if (mode === "lumpsum") return "lumpsum";
  return isDailySipFrequency(sipFrequency) ? "daily" : "monthly";
}

function tabIndex(tab: MfInvestTab): number {
  if (tab === "monthly") return 0;
  if (tab === "daily") return 1;
  return 2;
}

const tabButtonClass =
  "relative z-10 flex min-h-9 items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-medium transition-[color,opacity] duration-200 ease-out sm:gap-1.5 sm:px-3 sm:text-compact";

export function MfInvestModeToggle({
  mode,
  sipFrequency,
  onTabSelect,
  monthlySipAllowed,
  dailySipAllowed,
  lumpsumAllowed = true,
  disabled = false,
  showFolioNominationInfo = false,
}: MfInvestModeToggleProps) {
  const reduceMotion = useReducedMotion();
  const derivedTab = activeTab(mode, sipFrequency);
  const [pendingTab, setPendingTab] = useState<MfInvestTab | null>(null);

  useLayoutEffect(() => {
    if (pendingTab !== null && derivedTab === pendingTab) {
      setPendingTab(null);
    }
  }, [derivedTab, pendingTab]);

  const selected = pendingTab ?? derivedTab;
  const selectedIndex = tabIndex(selected);

  const pillTransition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 520, damping: 38, mass: 0.75 },
    [reduceMotion],
  );

  function selectTab(tab: MfInvestTab) {
    if (disabled || selected === tab) return;
    if (tab === "monthly" && !monthlySipAllowed) return;
    if (tab === "daily" && !dailySipAllowed) return;
    if (tab === "lumpsum" && !lumpsumAllowed) return;
    setPendingTab(tab);
    onTabSelect(tab);
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div
        role="tablist"
        aria-label={copy.mutualFunds.paymentCardTitle}
        className="relative grid min-w-0 flex-1 grid-cols-3 gap-0 rounded-full border border-border/80 bg-muted/20 p-0.5"
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
          disabled={disabled || !monthlySipAllowed}
          onClick={() => selectTab("monthly")}
          className={cn(
            tabButtonClass,
            (disabled || !monthlySipAllowed) && "cursor-not-allowed opacity-50",
            selected === "monthly"
              ? "text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Calendar className="size-3.5 shrink-0 opacity-90 sm:size-3.5" aria-hidden />
          {copy.mutualFunds.paymentCardSipFrequencyMonthly}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={selected === "daily"}
          disabled={disabled || !dailySipAllowed}
          title={
            !dailySipAllowed ? copy.mutualFunds.paymentCardSipFrequencyDailyUnavailable : undefined
          }
          onClick={() => selectTab("daily")}
          className={cn(
            tabButtonClass,
            (disabled || !dailySipAllowed) && "cursor-not-allowed opacity-50",
            selected === "daily"
              ? "text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Sun className="size-3.5 shrink-0 opacity-90" aria-hidden />
          {copy.mutualFunds.paymentCardSipFrequencyDaily}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={selected === "lumpsum"}
          disabled={disabled || !lumpsumAllowed}
          title={
            !lumpsumAllowed ? copy.mutualFunds.paymentCardLumpsumUnavailable : undefined
          }
          onClick={() => selectTab("lumpsum")}
          className={cn(
            tabButtonClass,
            (disabled || !lumpsumAllowed) && "cursor-not-allowed opacity-50",
            selected === "lumpsum"
              ? "text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <CreditCard className="size-3.5 shrink-0 opacity-90" aria-hidden />
          {copy.mutualFunds.paymentCardOneTime}
        </button>
      </div>
      {showFolioNominationInfo ? <MfFolioNominationInfoButton /> : null}
    </div>
  );
}
