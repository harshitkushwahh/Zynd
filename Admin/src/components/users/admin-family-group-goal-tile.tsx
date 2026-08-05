"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Target } from "lucide-react";

import { AdminFamilyGroupRoleBadge } from "@/components/users/admin-family-group-role-badge";
import type { AdminUserGoal } from "@/lib/admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { formatCompactInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type AdminFamilyGroupGoalTileProps = {
  goal: AdminUserGoal;
  href: string;
  className?: string;
};

function formatGoalDate(value: string | null | undefined) {
  if (!value) return null;
  return formatTimestampDetail(value).split(",")[0] ?? formatTimestampDetail(value);
}

function goalProgressVariant(progressPct: number): "idle" | "active" | "strong" | "complete" {
  if (progressPct >= 100) return "complete";
  if (progressPct >= 75) return "strong";
  if (progressPct > 0) return "active";
  return "idle";
}

export function AdminFamilyGroupGoalTile({ goal, href, className }: AdminFamilyGroupGoalTileProps) {
  const progress = Math.max(0, Math.min(100, goal.effective_progress_pct ?? goal.progress_pct));
  const current = goal.effective_current_amount_inr ?? goal.current_amount_inr;
  const target = goal.target_amount_inr;
  const progressClass = goalProgressVariant(progress);
  const tag = goal.tag ?? goal.template?.name ?? null;
  const scopeLabel = goal.family_group_id ? "Family goal" : "Personal goal";

  return (
    <Link
      href={href}
      className={cn("admin-family-group-goal-tile group", className)}
      aria-label={`${goal.title}, ${Math.round(progress)}% progress`}
    >
      <div className="admin-family-group-goal-tile__head">
        <span className="admin-family-group-goal-tile__icon" aria-hidden>
          <Target className="size-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="admin-family-group-goal-tile__title-row">
            <h3 className="admin-family-group-goal-tile__title truncate">{goal.title}</h3>
            <AdminFamilyGroupRoleBadge label={goal.status} kind="status" className="shrink-0" />
          </div>
          <div className="admin-family-group-goal-tile__meta">
            {tag ? <span className="admin-family-group-goal-tile__tag">{tag}</span> : null}
            {goal.target_date ? (
              <span className="admin-family-group-goal-tile__date">
                <CalendarDays className="size-3" strokeWidth={2.25} />
                Target by {formatGoalDate(goal.target_date)}
              </span>
            ) : null}
          </div>
        </div>
        <ChevronRight
          className="admin-family-group-goal-tile__chevron size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      <div className="admin-family-group-goal-tile__progress-row">
        <div className="admin-family-group-goal-tile__track" aria-hidden>
          <span
            className={cn(
              "admin-family-group-goal-tile__fill",
              `admin-family-group-goal-tile__fill--${progressClass}`,
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="admin-family-group-goal-tile__progress-value tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>

      <p className="admin-family-group-goal-tile__amount tabular-nums">
        {formatCompactInr(current)}
        <span className="admin-family-group-goal-tile__amount-label"> of {formatCompactInr(target)}</span>
      </p>
      <p className="admin-family-group-goal-tile__scope">{scopeLabel}</p>
    </Link>
  );
}
