"use client";

import type { LucideIcon } from "lucide-react";
import { Tag, Users } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { Goal } from "@/features/goals/api/goals-api";
import { goalPriorityThemeFor } from "@/features/goals/components/goal-priority-badge-picker";
import {
  goalStatusBadgeIcon,
  goalStatusBadgeVariant,
} from "@/features/goals/lib/goal-status-badge";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type GoalMetaChipProps = {
  icon: LucideIcon;
  label: string;
  containerClassName: string;
  iconClassName: string;
};

function GoalMetaChip({ icon: Icon, label, containerClassName, iconClassName }: GoalMetaChipProps) {
  return (
    <div
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-2 rounded-[var(--radius-control)] border px-3 text-compact shadow-sm",
        containerClassName,
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", iconClassName)} aria-hidden />
      <span className="truncate font-medium">{label}</span>
    </div>
  );
}

type GoalDetailMetaChipsProps = {
  goal: Goal;
  priorityLabel: string;
};

export function GoalDetailMetaChips({ goal, priorityLabel }: GoalDetailMetaChipsProps) {
  const priorityTheme = goalPriorityThemeFor(goal.priority);
  const PriorityIcon = priorityTheme.icon;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <StatusBadge
        variant={goalStatusBadgeVariant(goal.status)}
        icon={goalStatusBadgeIcon(goal.status)}
        className="h-9 px-3 text-compact"
      >
        {copy.goals.status[goal.status]}
      </StatusBadge>
      <GoalMetaChip
        icon={PriorityIcon}
        label={priorityLabel}
        containerClassName={priorityTheme.badge.selected}
        iconClassName={priorityTheme.iconClass.selected}
      />
      {goal.tag ? (
        <GoalMetaChip
          icon={Tag}
          label={goal.tag}
          containerClassName="border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200"
          iconClassName="text-slate-500 dark:text-slate-400"
        />
      ) : null}
      {goal.family_group_id ? (
        <GoalMetaChip
          icon={Users}
          label={copy.goals.familyGoalBadge}
          containerClassName="border-violet-200/80 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200"
          iconClassName="text-violet-600 dark:text-violet-300"
        />
      ) : null}
    </div>
  );
}
