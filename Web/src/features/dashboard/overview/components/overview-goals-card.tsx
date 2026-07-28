"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GOAL_PROGRESS_CARD_WIDTH_CLASS,
  GoalProgressCard,
} from "@/features/goals/components/goal-progress-card";
import { useMyGoalsQuery } from "@/features/goals/hooks/use-my-goals-query";
import { ZYND_CARD_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;

function MoreGoalsCircle({ count }: { count: number }) {
  return (
    <Link
      href="/dashboard/goals"
      className={cn(
        "flex size-[5.5rem] shrink-0 flex-col items-center justify-center rounded-full border border-dashed border-border bg-muted/20",
        "text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      )}
      aria-label={copy.dashboard.overview.goalsMoreAria.replace("{count}", String(count))}
    >
      <span className="text-body font-semibold tabular-nums text-foreground">+{count}</span>
      <span className="mt-0.5 text-[10px] font-medium">{copy.dashboard.overview.goalsMoreLabel}</span>
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

  return (
    <section
      className={cn(
        ZYND_CARD_RADIUS_CLASS,
        "min-w-0 border border-border bg-card shadow-zynd-low",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <Target className="size-4" strokeWidth={2.25} />
            </span>
            <div>
              <p className="text-compact font-semibold text-foreground">{overview.goalsTitle}</p>
              <p className="text-[11px] text-muted-foreground">{overview.goalsDescription}</p>
            </div>
          </div>
        </div>
        {!loading && !error && goals.length > 0 ? (
          <Button
            variant="muted"
            size="sm"
            className="shrink-0"
            nativeButton={false}
            render={<Link href="/dashboard/goals" />}
          >
            {overview.goalsViewAll}
          </Button>
        ) : null}
      </div>

      <div className="px-4 py-3.5">
        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton
                key={index}
                className={cn(GOAL_PROGRESS_CARD_WIDTH_CLASS, "h-[5.5rem] shrink-0 rounded-[var(--radius-card)]")}
              />
            ))}
          </div>
        ) : null}
        {error ? <FieldMessage variant="error" message={error} /> : null}
        {!loading && !error && previewGoals.length === 0 ? (
          <div className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 px-2 py-4 text-center">
            <p className="text-caption text-muted-foreground">{overview.goalsEmpty}</p>
            <Button
              variant="muted"
              size="sm"
              nativeButton={false}
              render={<Link href="/dashboard/goals" />}
            >
              {overview.goalsViewAll}
            </Button>
          </div>
        ) : null}
        {!loading && !error && previewGoals.length > 0 ? (
          <div className="flex items-center gap-3 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {previewGoals.map((goal) => (
              <GoalProgressCard key={goal.id} goal={goal} />
            ))}
            {remainingCount > 0 ? <MoreGoalsCircle count={remainingCount} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
