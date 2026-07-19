"use client";

import { Slider } from "@/components/ui/slider";
import { MF_CALC_PANEL_CLASS } from "@/features/invest/lib/mf-calculator-ui";
import { cn } from "@/lib/utils";

type MfCalculatorSliderFieldProps = {
  id: string;
  label: string;
  valueLabel: string;
  hint?: string;
  minLabel: string;
  maxLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  prominentValue?: boolean;
};

function normalizeSliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function MfCalculatorSliderField({
  id,
  label,
  valueLabel,
  hint,
  minLabel,
  maxLabel,
  value,
  min,
  max,
  step,
  onValueChange,
  disabled = false,
  prominentValue = false,
}: MfCalculatorSliderFieldProps) {
  return (
    <div className={MF_CALC_PANEL_CLASS}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label className="text-caption font-medium text-foreground" htmlFor={id}>
            {label}
          </label>
          {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <p
          className={cn(
            "shrink-0 text-right font-semibold tabular-nums text-foreground",
            prominentValue ? "text-compact" : "text-caption",
          )}
        >
          {valueLabel}
        </p>
      </div>
      <div className="mt-2.5 py-1 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5">
        <Slider
          id={id}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={(nextValue) => {
            const resolved = normalizeSliderValue(nextValue);
            if (resolved == null || !Number.isFinite(resolved)) return;
            onValueChange(Math.min(max, Math.max(min, resolved)));
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
