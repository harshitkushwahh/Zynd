"use client";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { FamilyGoalProgressCard } from "@/features/goals/components/family-goal-progress-card";
import { GoalsSectionEmptyState } from "@/features/goals/components/goals-section-empty-state";
import {
  GoalsContentFade,
  GoalsListPageHeader,
} from "@/features/goals/components/goals-page-loading-view";
import { GoalsListPageSkeleton } from "@/features/goals/components/goals-list-page-skeleton";
import { useCachedFamilyGoalsList } from "@/features/goals/hooks/use-cached-family-goals-list";
import { GOALS_LIST_HREF } from "@/features/goals/lib/goal-navigation";
import { copy } from "@/shared/config/copy";

export function GoalsFamilyListPage() {
  const { familyGoals, error, showSkeleton, hasResolved, reload } = useCachedFamilyGoalsList();

  return (
    <div className="space-y-6">
      <DashboardBreadcrumb
        items={[
          { label: copy.goals.title, href: GOALS_LIST_HREF },
          { label: copy.goals.familyGoalsListTitle },
        ]}
      />

      <GoalsListPageHeader
        title={copy.goals.familyGoalsListTitle}
        description={copy.goals.familyGoalsListDescription}
        loading={showSkeleton}
      />

      {showSkeleton ? <GoalsListPageSkeleton variant="family" /> : null}

      {!showSkeleton && error ? (
        <LoadErrorCard
          title={copy.goals.loadFailedTitle}
          description={error}
          retryLabel={copy.goals.retry}
          onRetry={() => void reload()}
        />
      ) : null}

      {hasResolved && !error && familyGoals.length === 0 ? (
        <GoalsSectionEmptyState variant="family" />
      ) : null}

      {hasResolved && !error && familyGoals.length > 0 ? (
        <GoalsContentFade>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {familyGoals.map((goal) => (
              <FamilyGoalProgressCard key={`${goal.family_group_id}-${goal.id}`} goal={goal} />
            ))}
          </div>
        </GoalsContentFade>
      ) : null}
    </div>
  );
}
