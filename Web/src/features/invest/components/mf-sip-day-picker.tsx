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

function formatSipDay(day: number) {
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
  maxDay?: number;
};

export function MfSipDayPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
  maxDay = DEFAULT_MAX_SIP_DAY,
}: MfSipDayPickerProps) {
  const [open, setOpen] = useState(false);
  const days = useMemo(() => buildSipDays(maxDay), [maxDay]);

  return (
    <div className="min-w-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex w-full items-center text-left transition-colors disabled:pointer-events-none disabled:opacity-50",
            compact
              ? "h-9 gap-2 rounded-[var(--radius-control)] border border-input bg-background px-3 text-compact hover:bg-muted/40"
              : "gap-2.5 rounded-[var(--radius-medium)] border border-border bg-background px-3 py-2 hover:bg-muted/20 data-popup-open:bg-muted/20",
          )}
        >
          {compact ? (
            <>
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{formatSipDay(value)}</span>
            </>
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
