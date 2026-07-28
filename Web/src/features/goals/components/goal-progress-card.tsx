"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { Goal } from "@/features/goals/api/goals-api";
import { formatGoalTargetCompact } from "@/features/goals/lib/goal-format";
import { goalDetailHref } from "@/features/goals/lib/goal-navigation";
import {
  goalStatusBadgeIcon,
  goalStatusBadgeVariant,
} from "@/features/goals/lib/goal-status-badge";
import { resolveGoalProgress } from "@/features/goals/lib/goal-summary";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { goalTemplateIconThemeFor } from "@/features/goals/lib/goal-template-meta";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export const GOAL_PROGRESS_CARD_WIDTH_CLASS = "w-[12rem]";

type GoalProgressCardProps = {
  goal: Goal;
};

type GoalProgressRingProps = {
  progress: number;
  icon: ReturnType<typeof getGoalTemplateIcon>;
  iconColorClass: string;
  targetLabel: string;
};

function goalIconColorClass(themeClass: string) {
  return themeClass
    .split(" ")
    .filter((token) => token.startsWith("text-") || token.startsWith("dark:text-"))
    .join(" ");
}

function GoalProgressRing({ progress, icon: Icon, iconColorClass, targetLabel }: GoalProgressRingProps) {
  const size = 68;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference * (1 - clampedProgress / 100);

  return (
    <div
      className="relative flex size-[4.25rem] shrink-0 items-center justify-center"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedProgress}
      aria-label={`${clampedProgress.toFixed(0)}% progress toward ${targetLabel}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-primary transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <Icon className={cn("size-4", iconColorClass)} strokeWidth={2.1} aria-hidden />
        <span className="text-[11px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
          {targetLabel}
        </span>
      </div>
    </div>
  );
}

export function GoalProgressCard({ goal }: GoalProgressCardProps) {
  const Icon = getGoalTemplateIcon(goal.template?.icon_key);
  const iconTheme = goalTemplateIconThemeFor(goal.template?.slug ?? "custom");
  const iconColorClass = goalIconColorClass(iconTheme.headerIconClass ?? iconTheme.iconBadgeClass);
  const progress = resolveGoalProgress(goal);
  const targetLabel = formatGoalTargetCompact(goal.target_amount_inr);
  const statusLabel = copy.goals.status[goal.status];

  return (
    <Link
      href={goalDetailHref(goal.id)}
      className={cn(
        GOAL_PROGRESS_CARD_WIDTH_CLASS,
        "group block shrink-0 rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      )}
      aria-label={`${goal.title}, ${statusLabel}, ${targetLabel} target`}
    >
      <div
        className={cn(
          "relative flex h-[5.5rem] flex-row items-center gap-2.5 rounded-[var(--radius-card)] border border-border bg-card p-2.5",
          "transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-zynd-low",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        )}
      >
        <ArrowUpRight
          className="absolute right-2 top-2 size-3.5 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />

        <GoalProgressRing
          progress={progress}
          icon={Icon}
          iconColorClass={iconColorClass}
          targetLabel={targetLabel}
        />

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 pr-3">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{goal.title}</p>
          <StatusBadge
            variant={goalStatusBadgeVariant(goal.status)}
            icon={goalStatusBadgeIcon(goal.status)}
            className="w-fit px-1.5 text-[10px]"
          >
            {statusLabel}
          </StatusBadge>
        </div>
      </div>
    </Link>
  );
}
