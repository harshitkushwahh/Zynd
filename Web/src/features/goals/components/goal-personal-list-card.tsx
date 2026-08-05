"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Goal } from "@/features/goals/api/goals-api";
import { goalDetailHref } from "@/features/goals/lib/goal-navigation";
import { monthsUntil } from "@/features/goals/lib/goal-calculator";
import {
  goalStatusBadgeIcon,
  goalStatusBadgeVariant,
} from "@/features/goals/lib/goal-status-badge";
import { resolveGoalProgress } from "@/features/goals/lib/goal-summary";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { goalTemplateIconThemeFor } from "@/features/goals/lib/goal-template-meta";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type GoalPersonalListCardProps = {
  goal: Goal;
};

export function GoalPersonalListCard({ goal }: GoalPersonalListCardProps) {
  const Icon = getGoalTemplateIcon(goal.template?.icon_key);
  const iconTheme = goalTemplateIconThemeFor(goal.template?.slug ?? "custom");
  const progress = resolveGoalProgress(goal);
  const saved = goal.effective_current_amount_inr ?? goal.current_amount_inr;
  const statusLabel = copy.goals.status[goal.status];
  const priorityLabel =
    copy.goals.priorityOptions[goal.priority as 1 | 2 | 3 | 4 | 5] ?? copy.goals.priorityOptions[3];

  return (
    <Link
      href={goalDetailHref(goal.id)}
      className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                iconTheme.iconBadgeClass,
              )}
            >
              <Icon className="size-5" strokeWidth={2.1} aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{goal.title}</CardTitle>
              <p className="text-compact text-muted-foreground">
                Target {formatInr(goal.target_amount_inr, { compact: true })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge
              variant={goalStatusBadgeVariant(goal.status)}
              icon={goalStatusBadgeIcon(goal.status)}
              className="text-[10px]"
            >
              {statusLabel}
            </StatusBadge>
            <Badge variant="secondary" className="text-[10px]">
              {priorityLabel}
            </Badge>
          </div>
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
              <span>
                {copy.goals.detailMonthsLeftLabel}: {copy.goals.monthsLabel(monthsUntil(goal.target_date))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
