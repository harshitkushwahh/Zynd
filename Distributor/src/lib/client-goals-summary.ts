import type { DistributorClientGoal } from "@/lib/dummy/types";

export type ClientGoalsSummary = {
  totalGoals: number;
  activeGoals: number;
  totalTargetAmount: number;
  totalInvestedAmount: number;
  activeInvestedAmount: number;
  progressPct: number;
};

export function summarizeClientGoals(goals: DistributorClientGoal[]): ClientGoalsSummary {
  const active = goals.filter((goal) => goal.status === "active");
  const totalTargetAmount = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalInvestedAmount = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const activeInvestedAmount = active.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const progressPct =
    totalTargetAmount > 0
      ? Math.min(100, Math.round((totalInvestedAmount / totalTargetAmount) * 100))
      : 0;

  return {
    totalGoals: goals.length,
    activeGoals: active.length,
    totalTargetAmount,
    totalInvestedAmount,
    activeInvestedAmount,
    progressPct,
  };
}
