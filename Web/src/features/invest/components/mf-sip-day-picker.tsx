"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const DEFAULT_MAX_SIP_DAY = 28;

function buildSipDays(maxDay: number) {
  return Array.from({ length: maxDay }, (_, index) => index + 1);
}

function formatOrdinalDay(day: number) {
  const mod10 = day % 10;
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  if (mod10 === 1) return `${day}st`;
  if (mod10 === 2) return `${day}nd`;
  if (mod10 === 3) return `${day}rd`;
  return `${day}th`;
}

function formatSipDay(
  day: number,
  compact = false,
  compactDisplay: "labeled" | "day" = "labeled",
) {
  if (compact && compactDisplay === "day") {
    return formatOrdinalDay(day);
  }
  if (compact) {
    return `${copy.mutualFunds.sipDayLabel} · ${formatOrdinalDay(day)}`;
  }
  return copy.mutualFunds.sipInstallmentDay.replace("{day}", String(day));
}

function SipDayGrid({
  days,
  value,
  onChange,
  compact = false,
  onSelect,
}: {
  days: number[];
  value: number;
  onChange: (day: number) => void;
  compact?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div className={cn("grid grid-cols-7", compact ? "gap-1" : "gap-1.5")}>
      {days.map((day) => (
        <button
          key={day}
          type="button"
          onClick={() => {
            onChange(day);
            onSelect?.();
          }}
          className={cn(
            "flex items-center justify-center rounded-[var(--radius-control)] font-medium transition-colors",
            compact ? "size-8 text-caption" : "size-9 text-compact",
            "hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50",
            value === day
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-foreground",
          )}
        >
          {day}
        </button>
      ))}
    </div>
  );
}

type MfSipDayPickerProps = {
  value: number;
  onChange: (day: number) => void;
  disabled?: boolean;
  compact?: boolean;
  compactDisplay?: "labeled" | "day";
  maxDay?: number;
  className?: string;
};

export function MfSipDayPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
  compactDisplay = "labeled",
  maxDay = DEFAULT_MAX_SIP_DAY,
  className,
}: MfSipDayPickerProps) {
  const [open, setOpen] = useState(false);
  const days = useMemo(() => buildSipDays(maxDay), [maxDay]);

  return (
    <div className={cn("min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          aria-label={
            compact && compactDisplay === "day"
              ? `${copy.mutualFunds.sipDayLabel}, ${formatOrdinalDay(value)}`
              : undefined
          }
          className={cn(
            "flex w-full items-center text-left transition-colors disabled:pointer-events-none disabled:opacity-50",
            compact
              ? cn(
                  "min-h-10 rounded-[var(--radius-card)] border border-border/80 bg-muted/15 py-2 hover:bg-muted/25 data-popup-open:bg-muted/30",
                  compactDisplay === "day"
                    ? "justify-between gap-1.5 px-2.5"
                    : "gap-1.5 px-2",
                )
              : "gap-2.5 rounded-[var(--radius-medium)] border border-border bg-background px-3 py-2 hover:bg-muted/20 data-popup-open:bg-muted/20",
          )}
        >
          {compact ? (
            compactDisplay === "day" ? (
              <>
                <span className="min-w-0 flex-1 truncate text-center text-compact font-medium tabular-nums text-foreground">
                  {formatOrdinalDay(value)}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </>
            ) : (
              <>
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-compact font-medium text-foreground">
                  {formatSipDay(value, true, compactDisplay)}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </>
            )
          ) : (
            <>
              <div className="sip-icon-badge flex size-8 shrink-0 items-center justify-center rounded-full">
                <CalendarDays className="size-3.5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-compact font-medium leading-none text-foreground">{formatSipDay(value)}</p>
              </div>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          className={cn(
            "rounded-[var(--radius-medium)] border-border p-0 shadow-lg",
            compact ? "w-[min(100vw-2rem,20rem)]" : "w-[min(100vw-2rem,22rem)]",
          )}
        >
          <div className="space-y-3 p-4">
            <div>
              <p className="text-compact font-medium text-foreground">{copy.mutualFunds.sipSelectDate}</p>
            </div>

            <SipDayGrid
              days={days}
              value={value}
              onChange={onChange}
              compact={compact}
              onSelect={() => setOpen(false)}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
