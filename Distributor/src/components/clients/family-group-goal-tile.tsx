"use client";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  isGoalInvested,
  resolveGoalCategoryIcon,
  resolveGoalPriorityBadgeVariant,
  resolveGoalPriorityLabel,
  resolveGoalTypeLabel,
  resolveGoalProgressPct,
} from "@/lib/client-goal-ui";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientGoal } from "@/lib/dummy/types";
import { formatAum } from "@/lib/format";

type FamilyGroupGoalTileProps = {
  goal: DistributorClientGoal;
  onOpenDetails: () => void;
};

export function FamilyGroupGoalTile({ goal, onOpenDetails }: FamilyGroupGoalTileProps) {
  const familyCopy = DISTRIBUTOR_CLIENT_COPY.family;
  const goalsCopy = DISTRIBUTOR_CLIENT_COPY.goals;
  const Icon = resolveGoalCategoryIcon(goal);
  const goalTypeLabel = resolveGoalTypeLabel(goal);
  const invested = isGoalInvested(goal);
  const progressPct = resolveGoalProgressPct(goal);
  const priority = goal.priority ?? "medium";

  return (
    <article className="distributor-family-group-goal-tile">
      <div className="distributor-family-group-goal-tile__head">
        <span className="distributor-client-goals-tile__icon" aria-hidden>
          <Icon className="size-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="distributor-client-goals-tile__title">{goal.title}</h3>
          {goal.createdByDisplayName ? (
            <p className="distributor-family-group-goal-tile__created-by text-caption text-muted-foreground">
              {familyCopy.familyGoalCreatedBy}{" "}
              <span className="font-medium text-foreground">{goal.createdByDisplayName}</span>
              {goal.createdByRole === "owner" ? ` · ${familyCopy.familyGoalCreatedByOwner}` : null}
            </p>
          ) : null}
        </div>
      </div>

      <div className="distributor-client-goals-tile__progress-row">
        <div className="distributor-client-goals-tile__progress-track" aria-hidden>
          <div
            className="distributor-client-goals-tile__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="distributor-client-goals-tile__progress-pct tabular-nums">
          {progressPct}%
        </span>
      </div>

      <p className="distributor-family-group-goal-tile__invested tabular-nums text-compact text-muted-foreground">
        {familyCopy.familyGoalAmountInvested}:{" "}
        <span className="font-semibold text-foreground">{formatAum(goal.currentAmount)}</span>
      </p>

      <div className="distributor-family-group-goal-tile__badges">
        <StatusBadge variant="neutral">
          {goalTypeLabel}
        </StatusBadge>
        <StatusBadge variant={resolveGoalPriorityBadgeVariant(priority)}>
          {resolveGoalPriorityLabel(priority)}
        </StatusBadge>
        {invested ? (
          <StatusBadge variant="success">
            {goalsCopy.investedBadge}
          </StatusBadge>
        ) : null}
      </div>

      <DistributorActionButton
        type="button"
        variant="outline"
        className="w-full justify-center"
        onClick={onOpenDetails}
      >
        {familyCopy.familyGoalDetailsAction}
      </DistributorActionButton>
    </article>
  );
}
