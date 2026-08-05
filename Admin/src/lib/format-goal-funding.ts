import { formatCompactInr } from "@/lib/format-inr";

export function goalDeclaredSavingsInr(goal: {
  existing_savings_inr?: number | null;
  current_amount_inr?: number | null;
  contribution_total_inr?: number | null;
}): number {
  if (goal.existing_savings_inr != null) {
    return Math.max(0, goal.existing_savings_inr);
  }

  const total = goal.current_amount_inr ?? 0;
  const contributed = goalContributionsInr(goal);
  return Math.max(0, total - contributed);
}

export function goalContributionsInr(goal: {
  contribution_total_inr?: number | null;
}): number {
  return Math.max(0, goal.contribution_total_inr ?? 0);
}

export function goalTotalProgressInr(goal: {
  current_amount_inr?: number | null;
  existing_savings_inr?: number | null;
  contribution_total_inr?: number | null;
}): number {
  if (goal.current_amount_inr != null) {
    return Math.max(0, goal.current_amount_inr);
  }
  return goalDeclaredSavingsInr(goal) + goalContributionsInr(goal);
}

export function formatGoalFundingBreakdown(
  declaredInr: number,
  contributionsInr: number,
): string {
  const parts: string[] = [];
  if (declaredInr > 0) {
    parts.push(`${formatCompactInr(declaredInr)} declared savings`);
  }
  if (contributionsInr > 0) {
    parts.push(`${formatCompactInr(contributionsInr)} contributed via Zynd`);
  }
  if (parts.length === 0) {
    return "No goal funding recorded yet";
  }
  return parts.join(" · ");
}

export function formatPortfolioGoalFundingHint(portfolio: {
  goal_declared_savings_inr?: number;
  goal_contributions_inr?: number;
  goal_funded_inr?: number;
}): string {
  if (
    portfolio.goal_declared_savings_inr != null ||
    portfolio.goal_contributions_inr != null
  ) {
    return formatGoalFundingBreakdown(
      portfolio.goal_declared_savings_inr ?? 0,
      portfolio.goal_contributions_inr ?? 0,
    );
  }

  const funded = portfolio.goal_funded_inr ?? 0;
  if (funded > 0) {
    return `${formatCompactInr(funded)} total progress`;
  }
  return "No goal funding recorded yet";
}
