"use client";

import { Loader2, Target } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { LoadErrorCard } from "@/components/ui/load-error-card";
import {
  type FamilyGoal,
  type FamilyGroupRole,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupGoalContributionsDialog } from "@/features/family-groups/components/family-group-goal-contributions-dialog";
import { useFamilyGroupGoalsQuery } from "@/features/family-groups/hooks/use-family-group-dashboard-queries";
import { FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { formatInr } from "@/features/invest/lib/mf-format";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupGoalsPanelProps = {
  groupId: string;
  myRole: FamilyGroupRole;
  className?: string;
};

function goalProgress(goal: FamilyGoal) {
  return goal.effective_current_amount_inr ?? goal.current_amount_inr;
}

function goalProgressPct(goal: FamilyGoal) {
  if (goal.target_amount_inr <= 0) return 0;
  return Math.min((goalProgress(goal) / goal.target_amount_inr) * 100, 100);
}

export function FamilyGroupGoalsPanel({ groupId, myRole, className }: FamilyGroupGoalsPanelProps) {
  const dashboard = copy.familyGroups.dashboard;
  const queryClient = useQueryClient();
  const { goals, showSkeleton, errorMessage, refetch, isFetching } = useFamilyGroupGoalsQuery(groupId);
  const [selectedGoal, setSelectedGoal] = useState<FamilyGoal | null>(null);

  const canContribute = myRole === "head" || myRole === "contributor";

  return (
    <section
      className={cn(
        FAMILY_GROUP_CARD_RADIUS_CLASS,
        "flex h-full flex-col border border-border bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      <div>
        <h3 className="text-body font-semibold text-foreground">{dashboard.goalsTitle}</h3>
        <p className="mt-1 text-compact text-muted-foreground">{dashboard.goalsSubtitle}</p>
      </div>

      <div className="mt-5 min-h-[18rem] flex-1">
        {showSkeleton ? (
          <div className="flex h-[18rem] items-center justify-center gap-2 text-compact text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {dashboard.goalsLoading}
          </div>
        ) : errorMessage ? (
          <LoadErrorCard
            title={dashboard.goalsLoadFailed}
            description={errorMessage}
            retryLabel={copy.familyGroups.errors.retry}
            retryLoading={isFetching}
            onRetry={() => void refetch()}
          />
        ) : goals.length === 0 ? (
          <div className="flex h-[18rem] flex-col items-center justify-center gap-3 px-4 text-center">
            <Target className="size-8 text-muted-foreground/70" />
            <p className="text-compact font-medium text-foreground">{dashboard.goalsEmptyTitle}</p>
            <p className="text-compact text-muted-foreground">{dashboard.goalsEmptyDescription}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {goals.map((goal) => {
              const progress = goalProgressPct(goal);
              return (
                <li key={goal.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedGoal(goal)}
                    className={cn(
                      FAMILY_GROUP_CARD_RADIUS_CLASS,
                      "w-full border border-border/70 bg-muted/10 p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/20",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Target className="size-4" strokeWidth={2.25} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-compact font-semibold text-foreground">{goal.title}</p>
                        <p className="mt-1 text-caption text-muted-foreground">
                          {formatInr(goalProgress(goal), { compact: true })} /{" "}
                          {formatInr(goal.target_amount_inr, { compact: true })}
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-2 text-caption tabular-nums text-muted-foreground">
                          {dashboard.goalProgressLabel(progress)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <FamilyGroupGoalContributionsDialog
        open={selectedGoal != null}
        onOpenChange={(open) => {
          if (!open) setSelectedGoal(null);
        }}
        groupId={groupId}
        goal={selectedGoal}
        canContribute={canContribute}
        onUpdated={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.family.goals(groupId) });
        }}
      />
    </section>
  );
}
