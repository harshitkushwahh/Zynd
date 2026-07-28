"use client";

import { Calculator, Lock, Plus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PREVIEW_TARGET_AMOUNT = 500_000;
const PREVIEW_RETURN_PCT = 12;
const PREVIEW_SIP = 12_450;
const PREVIEW_PROJECTED = 5_12_000;

function GoalCalculatorPreviewPlaceholder() {
  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="space-y-1 px-4 pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="size-4" aria-hidden />
          {copy.goals.calculatorTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-compact">{copy.goals.targetAmountLabel}</Label>
            <span className="text-compact font-medium">{formatInr(PREVIEW_TARGET_AMOUNT)}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 w-[58%] rounded-full bg-primary/70" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-compact">{copy.goals.expectedReturnLabel}</Label>
            <span className="text-compact font-medium">{PREVIEW_RETURN_PCT.toFixed(1)}%</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 w-[48%] rounded-full bg-primary/70" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3">
          <div>
            <p className="text-[11px] text-muted-foreground">{copy.goals.requiredSipLabel}</p>
            <p className="text-sm font-semibold">{formatInr(PREVIEW_SIP)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{copy.goals.projectedValueLabel}</p>
            <p className="text-sm font-semibold">{formatInr(PREVIEW_PROJECTED)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalCalculatorLockedOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-3">
      <div className="flex max-w-md items-center gap-2.5 px-3 py-2.5 shadow-zynd-mid backdrop-blur-sm sip-lock-panel">
        <div className="relative shrink-0">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-3.5" strokeWidth={2.25} />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
            <Plus className="size-2.5" strokeWidth={2.5} aria-hidden />
          </div>
        </div>
        <div className="min-w-0 text-left">
          <p className="text-compact font-semibold text-foreground">{copy.goals.calculatorLockedTitle}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {copy.goals.calculatorEmptyDescription}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GoalCalculatorEmptyState() {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-dashed border-border/80 bg-card",
        "min-h-[13.5rem]",
      )}
    >
      <div className={cn("pointer-events-none select-none blur-[5px]")}>
        <GoalCalculatorPreviewPlaceholder />
      </div>
      <div className="pointer-events-none absolute inset-0 sip-chart-overlay" aria-hidden />
      <GoalCalculatorLockedOverlay />
    </div>
  );
}
