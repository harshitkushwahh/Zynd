"use client";

import Link from "next/link";
import { useMemo } from "react";

import { FieldMessage } from "@/components/ui/ui-message";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import { OverviewCompactCardHeader } from "@/features/dashboard/overview/components/overview-compact-card-header";
import { OVERVIEW_GOALS_LOCKED_PREVIEW } from "@/features/dashboard/overview/lib/overview-locked-preview-data";
import {
  GOAL_PROGRESS_CARD_WIDTH_CLASS,
  GoalProgressCard,
  OVERVIEW_GOAL_TILE_HEIGHT_CLASS,
} from "@/features/goals/components/goal-progress-card";
import {
  OVERVIEW_CARD_RADIUS_CLASS,
  OVERVIEW_COMPACT_CARD_HEIGHT_CLASS,
  OVERVIEW_TILE_RADIUS_CLASS,
} from "@/features/dashboard/overview/lib/overview-card-styles";
import { useMyGoalsQuery } from "@/features/goals/hooks/use-my-goals-query";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;
const GOALS_HREF = "/dashboard/goals";

function MoreGoalsTile({ count }: { count: number }) {
  const overview = copy.dashboard.overview;

  return (
    <Link
      href={GOALS_HREF}
      className={cn(
        GOAL_PROGRESS_CARD_WIDTH_CLASS,
        OVERVIEW_TILE_RADIUS_CLASS,
        "flex shrink-0 flex-col items-center justify-center border border-dashed border-border/70 bg-muted/20",
        "text-muted-foreground transition-colors duration-200 hover:border-primary/35 hover:bg-primary/5 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        OVERVIEW_GOAL_TILE_HEIGHT_CLASS,
      )}
      aria-label={overview.goalsMoreAria.replace("{count}", String(count))}
    >
      <span className="text-body font-semibold tabular-nums text-foreground">+{count}</span>
      <span className="mt-0.5 text-[10px] font-medium">{overview.goalsMoreLabel}</span>
    </Link>
  );
}

type OverviewGoalsCardProps = {
  className?: string;
};

export function OverviewGoalsCard({ className }: OverviewGoalsCardProps) {
  const overview = copy.dashboard.overview;
  const { goals: allGoals, showSkeleton, errorMessage } = useMyGoalsQuery(true);
  const loading = showSkeleton;
  const error = errorMessage;

  const goals = useMemo(
    () => allGoals.filter((goal) => goal.status !== "archived"),
    [allGoals],
  );

  const previewGoals = useMemo(() => goals.slice(0, PREVIEW_LIMIT), [goals]);
  const remainingCount = Math.max(goals.length - previewGoals.length, 0);
  const isLocked = !loading && !error && previewGoals.length === 0;

  return (
    <section
      className={cn(
        OVERVIEW_CARD_RADIUS_CLASS,
        OVERVIEW_COMPACT_CARD_HEIGHT_CLASS,
        "relative flex min-w-0 flex-col overflow-hidden border border-border/60 bg-card p-3.5 shadow-zynd-low",
        className,
      )}
    >
      <OverviewCompactCardHeader
        title={overview.goalsTitle}
        href={GOALS_HREF}
        ariaLabel={overview.goalsViewAll}
      />

      {isLocked ? (
        <div className="relative mt-3 flex min-h-0 flex-1 flex-col">
          <div className="pointer-events-none flex h-full min-h-0 flex-1 select-none flex-col blur-[5px]">
            <div className="flex min-h-0 flex-1 items-center overflow-hidden">
              <div className="flex w-full items-stretch gap-3 overflow-hidden">
                {OVERVIEW_GOALS_LOCKED_PREVIEW.map((goal) => (
                  <GoalProgressCard key={goal.id} goal={goal} variant="overview" />
                ))}
              </div>
            </div>
          </div>
          <OverviewLockedCardBackdrop />
          <OverviewLockedCardOverlay
            compact
            title={overview.goalsTitle}
            subtitle={overview.goalsEmpty}
          />
        </div>
      ) : (
        <div className="mt-3 flex min-h-0 flex-1 items-center overflow-hidden">
          {loading ? (
            <div className="flex w-full gap-3 overflow-hidden">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className={cn(
                    GOAL_PROGRESS_CARD_WIDTH_CLASS,
                    "shrink-0",
                    OVERVIEW_GOAL_TILE_HEIGHT_CLASS,
                    OVERVIEW_TILE_RADIUS_CLASS,
                  )}
                />
              ))}
            </div>
          ) : null}
          {error ? <FieldMessage variant="error" message={error} /> : null}
          {previewGoals.length > 0 ? (
            <div className="flex w-full items-stretch gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {previewGoals.map((goal) => (
                <GoalProgressCard key={goal.id} goal={goal} variant="overview" />
              ))}
              {remainingCount > 0 ? <MoreGoalsTile count={remainingCount} /> : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function OverviewGoalsCardSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        OVERVIEW_CARD_RADIUS_CLASS,
        OVERVIEW_COMPACT_CARD_HEIGHT_CLASS,
        "flex min-w-0 flex-col overflow-hidden border border-border/60 bg-card p-3.5 shadow-zynd-low",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="size-3.5" />
      </div>
      <div className="mt-3 flex min-h-0 flex-1 items-center overflow-hidden">
        <div className="flex w-full gap-3 overflow-hidden">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn(
                GOAL_PROGRESS_CARD_WIDTH_CLASS,
                "shrink-0",
                OVERVIEW_GOAL_TILE_HEIGHT_CLASS,
                OVERVIEW_TILE_RADIUS_CLASS,
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
