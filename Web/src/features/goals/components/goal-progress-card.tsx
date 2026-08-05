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

export const GOAL_PROGRESS_CARD_WIDTH_CLASS = "w-[11rem]";
export const OVERVIEW_GOAL_TILE_HEIGHT_CLASS = "h-[5.25rem]";

type GoalProgressCardProps = {
  goal: Goal;
  variant?: "default" | "overview";
};

type GoalProgressRingProps = {
  progress: number;
  icon: ReturnType<typeof getGoalTemplateIcon>;
  iconColorClass: string;
  targetLabel: string;
  overview?: boolean;
};

function goalIconColorClass(themeClass: string) {
  return themeClass
    .split(" ")
    .filter((token) => token.startsWith("text-") || token.startsWith("dark:text-"))
    .join(" ");
}

function GoalProgressRing({
  progress,
  icon: Icon,
  iconColorClass,
  targetLabel,
  overview = false,
}: GoalProgressRingProps) {
  const size = overview ? 64 : 68;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference * (1 - clampedProgress / 100);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        overview ? "size-[4rem]" : "size-[4.25rem]",
      )}
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

export function GoalProgressCard({ goal, variant = "default" }: GoalProgressCardProps) {
  const isOverview = variant === "overview";
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
        "group block shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        isOverview ? "rounded-[1.75rem]" : "rounded-[var(--radius-card)]",
      )}
      aria-label={`${goal.title}, ${statusLabel}, ${targetLabel} target`}
    >
      <div
        className={cn(
          "relative flex flex-row items-center gap-2 border transition-[border-color,background-color,box-shadow] duration-200",
          isOverview
            ? cn(
                OVERVIEW_GOAL_TILE_HEIGHT_CLASS,
                "rounded-[1.75rem] border-border/60 bg-muted/30 p-2.5 hover:border-primary/25 hover:bg-muted/40",
              )
            : "h-[5.5rem] rounded-[var(--radius-card)] border-border bg-card p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-zynd-low motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        )}
      >
        <ArrowUpRight
          className={cn(
            "absolute text-muted-foreground transition-colors group-hover:text-primary",
            isOverview ? "right-2 top-2 size-3" : "right-2 top-2 size-3.5",
          )}
          strokeWidth={2}
          aria-hidden
        />

        <GoalProgressRing
          progress={progress}
          icon={Icon}
          iconColorClass={iconColorClass}
          targetLabel={targetLabel}
          overview={isOverview}
        />

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-2.5">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{goal.title}</p>
          <StatusBadge
            variant={goalStatusBadgeVariant(goal.status)}
            icon={goalStatusBadgeIcon(goal.status)}
            className={cn(
              "w-fit px-1.5 text-[10px]",
              isOverview && "h-5 rounded-[1.75rem]",
            )}
          >
            {statusLabel}
          </StatusBadge>
        </div>
      </div>
    </Link>
  );
}
