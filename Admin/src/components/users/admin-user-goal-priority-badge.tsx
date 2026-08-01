"use client";

import {
  ChevronDown,
  ChevronsDown,
  ChevronUp,
  Minus,
  Star,
  type LucideIcon,
} from "lucide-react";

import {
  formatAdminGoalPriorityLabel,
  normalizeAdminGoalPriority,
} from "@/lib/admin-goal-priority-ui";
import { cn } from "@/lib/utils";

const PRIORITY_ICONS: Record<number, LucideIcon> = {
  1: Star,
  2: ChevronUp,
  3: Minus,
  4: ChevronDown,
  5: ChevronsDown,
};

type AdminUserGoalPriorityBadgeProps = {
  priority: number;
  className?: string;
};

export function AdminUserGoalPriorityBadge({ priority, className }: AdminUserGoalPriorityBadgeProps) {
  const level = normalizeAdminGoalPriority(priority);
  const Icon = PRIORITY_ICONS[level] ?? Minus;
  const label = formatAdminGoalPriorityLabel(level);

  return (
    <span
      className={cn(
        "admin-user-goal-priority-badge",
        `admin-user-goal-priority-badge--${level}`,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="tabular-nums">{level}</span>
      <span className="admin-user-goal-priority-badge__label">{label}</span>
    </span>
  );
}
