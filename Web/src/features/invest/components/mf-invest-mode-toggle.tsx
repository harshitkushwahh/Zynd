"use client";

import { Calendar, CreditCard, Sun } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import {
  isDailySipFrequency,
  SIP_FREQUENCY_DAILY,
  SIP_FREQUENCY_MONTHLY,
  type SipFrequency,
} from "@/features/invest/lib/mf-sip-frequency";

type InvestMode = "sip" | "lumpsum";
type InvestTab = "monthly" | "daily" | "lumpsum";

export type MfInvestModeToggleProps = {
  mode: InvestMode;
  sipFrequency: SipFrequency;
  onModeChange: (mode: InvestMode) => void;
  onSipFrequencyChange: (frequency: SipFrequency) => void;
  monthlySipAllowed: boolean;
  dailySipAllowed: boolean;
  disabled?: boolean;
};

function activeTab(mode: InvestMode, sipFrequency: SipFrequency): InvestTab {
  if (mode === "lumpsum") return "lumpsum";
  return isDailySipFrequency(sipFrequency) ? "daily" : "monthly";
}

const tabButtonClass =
  "flex min-h-9 items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-medium transition-colors sm:gap-1.5 sm:px-3 sm:text-compact";

export function MfInvestModeToggle({
  mode,
  sipFrequency,
  onModeChange,
  onSipFrequencyChange,
  monthlySipAllowed,
  dailySipAllowed,
  disabled = false,
}: MfInvestModeToggleProps) {
  const selected = activeTab(mode, sipFrequency);

  function selectMonthly() {
    if (!monthlySipAllowed || disabled) return;
    onModeChange("sip");
    onSipFrequencyChange(SIP_FREQUENCY_MONTHLY);
  }

  function selectDaily() {
    if (!dailySipAllowed || disabled) return;
    onModeChange("sip");
    onSipFrequencyChange(SIP_FREQUENCY_DAILY);
  }

  function selectOneTime() {
    if (disabled) return;
    onModeChange("lumpsum");
  }

  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.paymentCardTitle}
      className="grid grid-cols-3 gap-0 rounded-full border border-border/80 bg-muted/20 p-0.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selected === "monthly"}
        disabled={disabled || !monthlySipAllowed}
        onClick={selectMonthly}
        className={cn(
          tabButtonClass,
          (disabled || !monthlySipAllowed) && "cursor-not-allowed opacity-50",
          selected === "monthly"
            ? "bg-foreground text-background shadow-zynd-low"
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
        onClick={selectDaily}
        className={cn(
          tabButtonClass,
          (disabled || !dailySipAllowed) && "cursor-not-allowed opacity-50",
          selected === "daily"
            ? "bg-foreground text-background shadow-zynd-low"
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
        disabled={disabled}
        onClick={selectOneTime}
        className={cn(
          tabButtonClass,
          disabled && "cursor-not-allowed opacity-60",
          selected === "lumpsum"
            ? "bg-foreground text-background shadow-zynd-low"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <CreditCard className="size-3.5 shrink-0 opacity-90" aria-hidden />
        {copy.mutualFunds.paymentCardOneTime}
      </button>
    </div>
  );
}
