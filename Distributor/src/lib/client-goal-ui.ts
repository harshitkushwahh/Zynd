import type { LucideIcon } from "lucide-react";
import { Car, Goal, GraduationCap, Heart, Home, Landmark, Shield, Sparkles } from "lucide-react";

import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type {
  DistributorClientGoal,
  DistributorClientGoalPriority,
  DistributorClientGoalType,
} from "@/lib/dummy/types";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  retirement: Landmark,
  education: GraduationCap,
  safety: Shield,
  wealth: Sparkles,
  home: Home,
  car: Car,
  wedding: Heart,
  custom: Sparkles,
};

const GOAL_TYPE_ICON: Record<DistributorClientGoalType, LucideIcon> = {
  home: Home,
  education: GraduationCap,
  car: Car,
  wedding: Heart,
  retirement: Landmark,
  custom: Sparkles,
};

function normalizeCategoryKey(value: string) {
  return value.trim().toLowerCase();
}

function resolveGoalLabelFromTitle(goal: DistributorClientGoal): string {
  const title = goal.title.toLowerCase();
  if (title.includes("retire")) return "Retirement";
  if (title.includes("education") || title.includes("child")) return "Education";
  if (title.includes("emergency") || title.includes("reserve")) return "Safety";
  if (title.includes("home") || title.includes("house")) return "Home";
  if (title.includes("car") || title.includes("vehicle")) return "Car";
  if (title.includes("wedding") || title.includes("marriage")) return "Wedding";
  return "Wealth";
}

export function resolveGoalCategoryLabel(goal: DistributorClientGoal): string {
  if (goal.category?.trim()) return goal.category.trim();
  if (goal.goalType) return resolveGoalTypeLabel(goal);
  return resolveGoalLabelFromTitle(goal);
}

export function resolveGoalTypeLabel(goal: DistributorClientGoal): string {
  const familyCopy = DISTRIBUTOR_CLIENT_COPY.family.familyGoalTypes;
  if (goal.goalType && goal.goalType in familyCopy) {
    return familyCopy[goal.goalType as keyof typeof familyCopy];
  }
  if (goal.category?.trim()) return goal.category.trim();
  return resolveGoalLabelFromTitle(goal);
}

export function resolveGoalPriorityLabel(priority: DistributorClientGoalPriority): string {
  const copy = DISTRIBUTOR_CLIENT_COPY.family;
  switch (priority) {
    case "high":
      return copy.familyGoalPriorityHigh;
    case "medium":
      return copy.familyGoalPriorityMedium;
    case "low":
      return copy.familyGoalPriorityLow;
    default:
      return copy.familyGoalPriorityMedium;
  }
}

export function resolveGoalPriorityBadgeVariant(
  priority: DistributorClientGoalPriority,
): StatusBadgeVariant {
  switch (priority) {
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
    default:
      return "neutral";
  }
}

export function resolveGoalCategoryIcon(goal: DistributorClientGoal): LucideIcon {
  if (goal.goalType) return GOAL_TYPE_ICON[goal.goalType] ?? Goal;
  const key = normalizeCategoryKey(goal.category ?? resolveGoalCategoryLabel(goal));
  return CATEGORY_ICON[key] ?? Goal;
}

export function isGoalInvested(goal: DistributorClientGoal): boolean {
  return goal.currentAmount > 0;
}

/** Progress toward target; at least 1% when there is any savings but share rounds to 0. */
export function resolveGoalProgressPct(goal: DistributorClientGoal): number {
  const { currentAmount, targetAmount, progressPct } = goal;
  if (targetAmount > 0 && currentAmount > 0) {
    const raw = (currentAmount / targetAmount) * 100;
    if (raw > 0 && raw < 1) return 1;
    return Math.min(100, Math.round(raw));
  }
  return Math.min(100, Math.max(0, progressPct));
}

export function resolveGoalStatusBadgeVariant(
  status: DistributorClientGoal["status"],
): StatusBadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "achieved":
      return "info";
    case "paused":
      return "warning";
    case "draft":
    default:
      return "neutral";
  }
}

export function resolveGoalStatusLabel(status: DistributorClientGoal["status"]): string {
  const labels = DISTRIBUTOR_CLIENT_COPY.goals.status;
  return labels[status] ?? status;
}
