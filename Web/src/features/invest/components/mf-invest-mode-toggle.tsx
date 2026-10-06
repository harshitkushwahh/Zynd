"use client";

import { Calendar, ChevronDown, CreditCard, Sun } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import {
  isDailySipFrequency,
  SIP_FREQUENCY_DAILY,
  SIP_FREQUENCY_MONTHLY,
  type SipFrequency,
} from "@/features/invest/lib/mf-sip-frequency";
type InvestMode = "sip" | "lumpsum";

export type MfInvestModeToggleProps = {
  mode: InvestMode;
  sipFrequency: SipFrequency;
  onModeChange: (mode: InvestMode) => void;
  onSipFrequencyChange: (frequency: SipFrequency) => void;
  dailySipAllowed: boolean;
  disabled?: boolean;
};

function sipFrequencyLabel(frequency: SipFrequency) {
  return isDailySipFrequency(frequency)
    ? copy.mutualFunds.paymentCardSipFrequencyDaily
    : copy.mutualFunds.paymentCardSipFrequencyMonthly;
}

export function MfInvestModeToggle({
  mode,
  sipFrequency,
  onModeChange,
  onSipFrequencyChange,
  dailySipAllowed,
  disabled = false,
}: MfInvestModeToggleProps) {
  const sipActive = mode === "sip";
  /** Always offer Monthly/Daily picker on active SIP; Daily is disabled when OMS has no daily bucket. */
  const showSipFrequencyDropdown = sipActive;

  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.paymentCardTitle}
      className="grid grid-cols-2 gap-0 rounded-full border border-border/80 bg-muted/20 p-0.5"
    >
      {showSipFrequencyDropdown ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            className={cn(
              "flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-compact font-medium outline-none transition-colors",
              "bg-foreground text-background shadow-zynd-low",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <span>{copy.mutualFunds.paymentCardSip}</span>
            <span className="text-background/70" aria-hidden>
              ·
            </span>
            <span>{sipFrequencyLabel(sipFrequency)}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-80" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-[10.5rem]">
            <DropdownMenuItem
              onClick={() => onSipFrequencyChange(SIP_FREQUENCY_MONTHLY)}
              className="gap-2"
            >
              <Calendar className="size-4 text-muted-foreground" aria-hidden />
              {copy.mutualFunds.paymentCardSipFrequencyMonthly}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!dailySipAllowed}
              onClick={() => {
                if (dailySipAllowed) onSipFrequencyChange(SIP_FREQUENCY_DAILY);
              }}
              className="gap-2"
            >
              <Sun className="size-4 text-muted-foreground" aria-hidden />
              {copy.mutualFunds.paymentCardSipFrequencyDaily}
              {!dailySipAllowed ? (
                <span className="ml-auto text-caption text-muted-foreground">
                  {copy.mutualFunds.paymentCardSipFrequencyDailyUnavailable}
                </span>
              ) : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          type="button"
          role="tab"
          aria-selected={sipActive}
          disabled={disabled}
          onClick={() => onModeChange("sip")}
          className={cn(
            "flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-compact font-medium transition-colors",
            disabled && "cursor-not-allowed opacity-60",
            sipActive
              ? "bg-foreground text-background shadow-zynd-low"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Calendar className="size-3.5 shrink-0 opacity-90" aria-hidden />
          {copy.mutualFunds.paymentCardSip}
        </button>
      )}

      <button
        type="button"
        role="tab"
        aria-selected={mode === "lumpsum"}
        disabled={disabled}
        onClick={() => onModeChange("lumpsum")}
        className={cn(
          "flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-compact font-medium transition-colors",
          disabled && "cursor-not-allowed opacity-60",
          mode === "lumpsum"
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
