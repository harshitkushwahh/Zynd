"use client";

import { useMemo } from "react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { GoalPersonalListCard } from "@/features/goals/components/goal-personal-list-card";
import { GoalsSectionEmptyState } from "@/features/goals/components/goals-section-empty-state";
import {
  GoalsContentFade,
  GoalsListPageHeader,
} from "@/features/goals/components/goals-page-loading-view";
import { GoalsListPageSkeleton } from "@/features/goals/components/goals-list-page-skeleton";
import { useCachedPersonalGoalsList } from "@/features/goals/hooks/use-cached-personal-goals-list";
import { GOALS_LIST_HREF } from "@/features/goals/lib/goal-navigation";
import { copy } from "@/shared/config/copy";

export function GoalsPersonalListPage() {
  const { goals, error, showSkeleton, hasResolved, reload } = useCachedPersonalGoalsList();

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status !== "archived"),
    [goals],
  );

  return (
    <div className="space-y-6">
      <DashboardBreadcrumb
        items={[
          { label: copy.goals.title, href: GOALS_LIST_HREF },
          { label: copy.goals.personalGoalsListTitle },
        ]}
      />

      <GoalsListPageHeader
        title={copy.goals.personalGoalsListTitle}
        description={copy.goals.personalGoalsListDescription}
        loading={showSkeleton}
      />

      {showSkeleton ? <GoalsListPageSkeleton variant="personal" /> : null}

      {!showSkeleton && error ? (
        <LoadErrorCard
          title={copy.goals.loadFailedTitle}
          description={error}
          retryLabel={copy.goals.retry}
          onRetry={() => void reload()}
        />
      ) : null}

      {hasResolved && !error && activeGoals.length === 0 ? (
        <GoalsSectionEmptyState variant="personal" />
      ) : null}

      {hasResolved && !error && activeGoals.length > 0 ? (
        <GoalsContentFade>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeGoals.map((goal) => (
              <GoalPersonalListCard key={goal.id} goal={goal} />
            ))}
          </div>
        </GoalsContentFade>
      ) : null}
    </div>
  );
}
