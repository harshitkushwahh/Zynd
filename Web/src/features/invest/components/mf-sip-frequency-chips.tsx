"use client";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import type { SipFrequency } from "@/features/invest/lib/mf-sip-frequency";
import { SIP_FREQUENCY_DAILY, SIP_FREQUENCY_MONTHLY } from "@/features/invest/lib/mf-sip-frequency";

export type MfSipFrequencyChipsProps = {
  value: SipFrequency;
  onChange: (frequency: SipFrequency) => void;
  monthlyAllowed: boolean;
  dailyAllowed: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function MfSipFrequencyChips({
  value,
  onChange,
  monthlyAllowed,
  dailyAllowed,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: MfSipFrequencyChipsProps) {
  if (!monthlyAllowed && !dailyAllowed) return null;
  if (monthlyAllowed && !dailyAllowed) return null;
  if (!monthlyAllowed && dailyAllowed) return null;

  const options: { id: SipFrequency; label: string }[] = [
    { id: SIP_FREQUENCY_MONTHLY, label: copy.mutualFunds.paymentCardSipFrequencyMonthly },
    { id: SIP_FREQUENCY_DAILY, label: copy.mutualFunds.paymentCardSipFrequencyDaily },
  ].filter((option) => (option.id === SIP_FREQUENCY_MONTHLY ? monthlyAllowed : dailyAllowed));

  if (options.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel ?? copy.mutualFunds.sipFrequency}
      className={cn(
        "grid grid-cols-2 gap-1 rounded-full border border-border/80 bg-muted/20 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-3 py-2 text-compact font-medium transition-colors",
              disabled && "cursor-not-allowed opacity-60",
              isActive
                ? "bg-foreground text-background shadow-zynd-low"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
