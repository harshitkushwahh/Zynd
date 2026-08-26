"use client";

import Link from "next/link";
import { Users } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GoalStatus } from "@/features/goals/api/goals-api";
import type { DashboardFamilyGoal } from "@/features/goals/lib/goal-family-goals";
import { resolveFamilyGoalProgress } from "@/features/goals/lib/goal-family-goals";
import {
  goalStatusBadgeIcon,
  goalStatusBadgeVariant,
} from "@/features/goals/lib/goal-status-badge";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";

type FamilyGoalProgressCardProps = {
  goal: DashboardFamilyGoal;
};

export function FamilyGoalProgressCard({ goal }: FamilyGoalProgressCardProps) {
  const progress = resolveFamilyGoalProgress(goal);
  const saved = goal.effective_current_amount_inr ?? goal.current_amount_inr;
  const status = goal.status as GoalStatus;
  const statusLabel = copy.goals.status[status] ?? goal.status;

  return (
    <Link
      href={buildFamilyGroupHref({ id: goal.family_group_id, title: goal.groupTitle })}
      className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Card className="h-full border border-border/60 shadow-none ring-0 transition-colors hover:border-border/80">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{goal.title}</CardTitle>
              <p className="text-compact text-muted-foreground">
                {goal.groupTitle} · Target {formatInr(goal.target_amount_inr, { compact: true })}
              </p>
            </div>
          </div>
          <StatusBadge
            variant={goalStatusBadgeVariant(status)}
            icon={goalStatusBadgeIcon(status)}
          >
            {statusLabel}
          </StatusBadge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-compact">
              <span className="text-muted-foreground">{copy.goals.progressLabel}</span>
              <span className="font-medium">{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-compact text-muted-foreground">
              <span>{formatInr(saved, { compact: true })} saved</span>
              <span>{copy.goals.familyGoalBadge}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
