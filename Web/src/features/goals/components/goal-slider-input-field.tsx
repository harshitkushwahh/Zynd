"use client";

import type { LucideIcon } from "lucide-react";
import { CircleHelp } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type GoalSliderInputFieldProps = {
  id: string;
  label: string;
  value: number;
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  minLabel: string;
  maxLabel: string;
  disabled?: boolean;
  density?: "default" | "compact";
  variant?: "default" | "card";
  icon?: LucideIcon;
  infoTooltip?: string;
  indicatorClassName?: string;
  valueClassName?: string;
  iconClassName?: string;
  sliderClassName?: string;
  className?: string;
};

function normalizeSliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? value[0] : value;
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function GoalSliderInputField({
  id,
  label,
  value,
  valueDisplay,
  min,
  max,
  step,
  onChange,
  minLabel,
  maxLabel,
  disabled = false,
  density = "default",
  variant = "default",
  icon: Icon,
  infoTooltip,
  indicatorClassName,
  valueClassName,
  iconClassName,
  sliderClassName,
  className,
}: GoalSliderInputFieldProps) {
  const isCompact = density === "compact";
  const isCard = variant === "card";
  const sliderValue = clampValue(value, min, max);

  const labelRow = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1.5">
        {Icon ? (
          <Icon className={cn("size-3.5 shrink-0 text-muted-foreground", iconClassName)} aria-hidden />
        ) : null}
        <Label htmlFor={id} className={cn(isCompact ? "text-compact" : undefined, "truncate")}>
          {label}
        </Label>
        {infoTooltip ? (
          <Tooltip>
            <TooltipTrigger
              type="button"
              className="inline-flex shrink-0 rounded-full text-muted-foreground/80 transition-colors hover:text-muted-foreground"
              aria-label={`More about ${label}`}
            >
              <CircleHelp className="size-3.5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>{infoTooltip}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <span className={cn("shrink-0 text-compact font-semibold tabular-nums text-foreground", valueClassName)}>
        {valueDisplay}
      </span>
    </div>
  );

  const sliderControl = (
    <>
      <div
        className={cn(
          "py-1 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5",
          sliderClassName,
        )}
      >
        <Slider
          id={id}
          value={sliderValue}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          indicatorClassName={indicatorClassName}
          onValueChange={(nextValue) => {
            const resolved = normalizeSliderValue(nextValue);
            if (resolved == null || !Number.isFinite(resolved)) return;
            onChange(clampValue(resolved, min, max));
          }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </>
  );

  if (isCard) {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-card)] border border-border/70 bg-muted/20 p-3.5 shadow-sm",
          className,
        )}
      >
        <div className={cn("space-y-2", isCompact && "space-y-1.5")}>
          {labelRow}
          {sliderControl}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(isCompact ? "space-y-1.5" : "space-y-2", className)}>
      {labelRow}
      {sliderControl}
    </div>
  );
}
