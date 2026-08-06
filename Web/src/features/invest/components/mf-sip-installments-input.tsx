"use client";

import { Minus, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  SIP_ORDER_MAX_INSTALLMENTS,
  SIP_ORDER_MIN_INSTALLMENTS,
  clampOrderInstallments,
  formatInstallmentDuration,
} from "@/features/invest/lib/mf-sip-calculator";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export function MfSipInstallmentsInput({
  value,
  onChange,
  disabled,
  error,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  function handleStep(delta: number) {
    onChange(clampOrderInstallments(value + delta));
  }

  function handleInput(rawValue: string) {
    const digits = rawValue.replace(/[^\d]/g, "");
    if (!digits) {
      onChange(SIP_ORDER_MIN_INSTALLMENTS);
      return;
    }
    onChange(clampOrderInstallments(Number(digits)));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor="mf-sip-installments"
          className="text-caption font-medium text-muted-foreground"
        >
          {copy.mutualFunds.paymentCardInstallmentsLabel}
        </label>
      </div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-card)] border border-border/80 bg-muted/15 px-2 py-1.5",
          error && "border-destructive/40",
        )}
      >
        <button
          type="button"
          disabled={disabled || value <= SIP_ORDER_MIN_INSTALLMENTS}
          onClick={() => handleStep(-1)}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Decrease number of instalments"
        >
          <Minus className="size-3.5" />
        </button>
        <input
          id="mf-sip-installments"
          type="text"
          inputMode="numeric"
          value={value > 0 ? String(value) : ""}
          onChange={(event) => handleInput(event.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 border-0 bg-transparent text-center text-body font-semibold tabular-nums text-foreground shadow-none outline-none focus-visible:ring-0"
        />
        <button
          type="button"
          disabled={disabled || value >= SIP_ORDER_MAX_INSTALLMENTS}
          onClick={() => handleStep(1)}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Increase number of instalments"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {error ? (
        <Badge
          variant="outline"
          className="border-destructive/30 bg-destructive/10 text-destructive"
        >
          {error}
        </Badge>
      ) : null}
    </div>
  );
}
