"use client";

import { CalendarDays, Target } from "lucide-react";

import { AdminCircularProgressRing } from "@/components/ui/admin-circular-progress-ring";
import { AdminOverviewStatCell } from "@/components/ui/admin-overview-stat-cell";
import { AdminFamilyGroupRoleBadge } from "@/components/users/admin-family-group-role-badge";
import type { AdminFamilyGroupAnalyticsGoal } from "@/lib/family-groups-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import {
  formatGoalFundingBreakdown,
  goalContributionsInr,
  goalDeclaredSavingsInr,
  goalTotalProgressInr,
} from "@/lib/format-goal-funding";
import { formatCompactInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type AdminFamilyGroupGoalCardProps = {
  goal: AdminFamilyGroupAnalyticsGoal;
  className?: string;
};

function formatGoalDate(value: string | null) {
  if (!value) return null;
  return formatTimestampDetail(value).split(",")[0] ?? formatTimestampDetail(value);
}

export function AdminFamilyGroupGoalCard({ goal, className }: AdminFamilyGroupGoalCardProps) {
  const progress = Math.max(0, Math.min(100, goal.progress_pct));
  const target = goal.target_amount_inr ?? 0;
  const declared = goalDeclaredSavingsInr(goal);
  const contributed = goalContributionsInr(goal);
  const totalProgress = goalTotalProgressInr(goal);
  const remaining = Math.max(0, target - totalProgress);
  const fundingBreakdown = formatGoalFundingBreakdown(declared, contributed);

  return (
    <article className={cn("admin-overview-card", className)}>
      <div className="admin-overview-card__body">
        <div className="admin-overview-card__head">
          <AdminCircularProgressRing
            size="lg"
            progressPct={progress}
            primaryLabel={`${Math.round(progress)}%`}
            secondaryLabel="progress"
            ariaLabel={`${Math.round(progress)}% goal progress`}
          />
          <div className="admin-overview-card__copy">
            <div className="admin-overview-card__title-row">
              <h3 className="admin-overview-card__title">{goal.title}</h3>
              <AdminFamilyGroupRoleBadge label={goal.status} kind="status" className="shrink-0" />
            </div>
            <div className="admin-overview-card__description flex flex-wrap items-center gap-x-2 gap-y-1">
              {goal.tag ? <span className="admin-family-group-goal-card__tag">{goal.tag}</span> : null}
              {goal.target_date ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" strokeWidth={2.25} aria-hidden />
                  Target by {formatGoalDate(goal.target_date)}
                </span>
              ) : null}
            </div>
            <p className="admin-overview-card__amount tabular-nums">
              {formatCompactInr(totalProgress)}
              <span className="admin-overview-card__amount-label">
                {" "}
                of {formatCompactInr(target)} target
              </span>
            </p>
            <p className="admin-overview-card__description">{fundingBreakdown}</p>
          </div>
        </div>

        <div className="admin-overview-stat-grid">
          <AdminOverviewStatCell label="Target" value={formatCompactInr(target)} />
          <AdminOverviewStatCell
            label="Declared savings"
            value={formatCompactInr(declared)}
            tone={declared > 0 ? "success" : "muted"}
          />
          <AdminOverviewStatCell
            label="Contributions"
            value={formatCompactInr(contributed)}
            tone={contributed > 0 ? "success" : "muted"}
          />
          <AdminOverviewStatCell
            label="Remaining"
            value={formatCompactInr(remaining)}
            tone="warning"
          />
        </div>
      </div>
    </article>
  );
}
