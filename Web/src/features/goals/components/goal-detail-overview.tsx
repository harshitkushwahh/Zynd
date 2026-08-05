"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Clock3,
  IndianRupee,
  PiggyBank,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import type { GoalCalculatorResult } from "@/features/goals/api/goals-api";
import { GoalCalculatorResults } from "@/features/goals/components/goal-calculator-results";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type GoalDetailMetricTileProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName: string;
  valueClassName?: string;
  className?: string;
};

export function GoalDetailMetricTile({
  label,
  value,
  icon: Icon,
  iconClassName,
  valueClassName,
  className,
}: GoalDetailMetricTileProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-[var(--radius-card)] border border-border/70 bg-background px-3 py-3 shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)-2px)] border",
          iconClassName,
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p
          className={cn("truncate text-sm font-semibold tabular-nums text-foreground", valueClassName)}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

type GoalDetailProgressCardProps = {
  progress: number;
  savedAmount: number;
  targetAmount: number;
  remainingAmount: number;
};

export function GoalDetailProgressCard({
  progress,
  savedAmount,
  targetAmount,
  remainingAmount,
}: GoalDetailProgressCardProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <Card className="overflow-hidden border border-border shadow-sm ring-0">
      <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
        <CardTitle className="text-base">{copy.goals.detailProgressTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
              {clampedProgress.toFixed(1)}%
            </p>
            <p className="mt-1 text-compact text-muted-foreground">{copy.goals.progressLabel}</p>
          </div>
          <p className="max-w-[14rem] text-right text-compact leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{formatInr(savedAmount)}</span>{" "}
            {copy.goals.detailOfTargetLabel}{" "}
            <span className="font-medium text-foreground">{formatInr(targetAmount)}</span>
          </p>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-muted/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <GoalDetailMetricTile
            label={copy.goals.detailSavedLabel}
            value={formatInr(savedAmount)}
            icon={PiggyBank}
            iconClassName="border-emerald-200/70 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
            valueClassName="text-emerald-700 dark:text-emerald-300"
          />
          <GoalDetailMetricTile
            label={copy.goals.detailRemainingLabel}
            value={formatInr(remainingAmount)}
            icon={Target}
            iconClassName="border-amber-200/70 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            valueClassName="text-amber-700 dark:text-amber-300"
          />
          <GoalDetailMetricTile
            label={copy.goals.targetAmountLabel}
            value={formatInr(targetAmount)}
            icon={IndianRupee}
            iconClassName="border-blue-200/70 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
            valueClassName="text-blue-700 dark:text-blue-300"
          />
        </div>
      </CardContent>
    </Card>
  );
}

type GoalDetailTargetCardProps = {
  targetDateLabel: string;
  monthsLeftLabel: string;
  expectedReturnLabel: string;
};

export function GoalDetailTargetCard({
  targetDateLabel,
  monthsLeftLabel,
  expectedReturnLabel,
}: GoalDetailTargetCardProps) {
  return (
    <Card className="border border-border shadow-sm ring-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{copy.goals.createSectionTargetTitle}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <GoalDetailMetricTile
          label={copy.goals.targetDateLabel}
          value={targetDateLabel}
          icon={CalendarDays}
          iconClassName="border-violet-200/70 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
        />
        <GoalDetailMetricTile
          label={copy.goals.detailMonthsLeftLabel}
          value={monthsLeftLabel}
          icon={Clock3}
          iconClassName="border-slate-200/70 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300"
        />
        <GoalDetailMetricTile
          label={copy.goals.expectedReturnLabel}
          value={expectedReturnLabel}
          icon={TrendingUp}
          iconClassName="border-teal-200/70 bg-teal-50 text-teal-600 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300"
          valueClassName="text-teal-700 dark:text-teal-300"
        />
      </CardContent>
    </Card>
  );
}

type GoalDetailPlanCardProps = {
  plan: GoalCalculatorResult | null;
  loading?: boolean;
};

export function GoalDetailPlanCard({ plan, loading = false }: GoalDetailPlanCardProps) {
  return (
    <Card className="h-full border border-border shadow-sm ring-0">
      <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          {copy.goals.detailPlanTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {loading ? (
          <p className="text-compact text-muted-foreground">{copy.goals.loading}</p>
        ) : plan ? (
          <GoalCalculatorResults result={plan} variant="sidebar" />
        ) : (
          <p className="text-compact text-muted-foreground">{copy.goals.detailPlanUnavailable}</p>
        )}
      </CardContent>
    </Card>
  );
}
