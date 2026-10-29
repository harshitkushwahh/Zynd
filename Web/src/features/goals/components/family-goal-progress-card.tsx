"use client";

import { FamilyGoalRichCard } from "@/features/goals/components/family-goal-rich-card";
import type { DashboardFamilyGoal } from "@/features/goals/lib/goal-family-goals";

type FamilyGoalProgressCardProps = {
  goal: DashboardFamilyGoal;
  layout?: "scroll" | "grid";
  className?: string;
};

export function FamilyGoalProgressCard({
  goal,
  layout = "scroll",
  className,
}: FamilyGoalProgressCardProps) {
  return <FamilyGoalRichCard goal={goal} layout={layout} className={className} />;
}
