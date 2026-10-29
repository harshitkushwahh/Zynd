"use client";

import type { Goal } from "@/features/goals/api/goals-api";
import { GoalRichCard } from "@/features/goals/components/goal-rich-card";

type GoalPersonalListCardProps = {
  goal: Goal;
};

export function GoalPersonalListCard({ goal }: GoalPersonalListCardProps) {
  return <GoalRichCard goal={goal} layout="grid" />;
}
