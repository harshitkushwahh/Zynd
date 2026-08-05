import type { Goal } from "@/features/goals/api/goals-api";
import type { DashboardFamilyGoal } from "@/features/goals/lib/goal-family-goals";
import { resolveFamilyGoalProgress } from "@/features/goals/lib/goal-family-goals";

export type GoalSummaryChartSlice = {
  id: string;
  label: string;
  value: number;
  fill: string;
  covered: boolean;
  progress: number;
  kind: "personal" | "family";
  personalGoal?: Goal;
  familyGoal?: DashboardFamilyGoal;
};

const GOAL_SUMMARY_SLICE_COLORS: Record<string, string> = {
  car: "#3b82f6",
  travel: "#14b8a6",
  education: "#8b5cf6",
  wedding: "#f43f5e",
  home: "#10b981",
  retirement: "#f59e0b",
  family: "#6366f1",
  custom: "var(--primary)",
};

export function resolveGoalProgress(goal: Goal) {
  return Math.min(Math.max(goal.effective_progress_pct ?? goal.progress_pct ?? 0, 0), 100);
}

export function isGoalCovered(goal: Goal) {
  return goal.status === "achieved" || resolveGoalProgress(goal) > 0;
}

export function isFamilyGoalCovered(goal: DashboardFamilyGoal) {
  return goal.status === "achieved" || resolveFamilyGoalProgress(goal) > 0;
}

export function pickTopPriorityGoal(goals: Goal[]) {
  if (goals.length === 0) return null;

  return [...goals].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    return resolveGoalProgress(right) - resolveGoalProgress(left);
  })[0];
}

export function pickTopPrioritySummarySlice(slices: GoalSummaryChartSlice[]) {
  if (slices.length === 0) return null;

  return [...slices].sort((left, right) => {
    const leftPriority =
      left.personalGoal?.priority ?? left.familyGoal?.priority ?? GOAL_SUMMARY_DEFAULT_PRIORITY;
    const rightPriority =
      right.personalGoal?.priority ?? right.familyGoal?.priority ?? GOAL_SUMMARY_DEFAULT_PRIORITY;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return right.progress - left.progress;
  })[0];
}

const GOAL_SUMMARY_DEFAULT_PRIORITY = 3;

export function computeOverallCoverage(goals: Goal[]) {
  if (goals.length === 0) return 0;

  const totalTarget = goals.reduce((sum, goal) => sum + Math.max(goal.target_amount_inr, 0), 0);
  if (totalTarget <= 0) {
    const average = goals.reduce((sum, goal) => sum + resolveGoalProgress(goal), 0) / goals.length;
    return Math.round(average);
  }

  const weighted = goals.reduce(
    (sum, goal) => sum + resolveGoalProgress(goal) * Math.max(goal.target_amount_inr, 0),
    0,
  );
  return Math.round(weighted / totalTarget);
}

export function computeSummarySliceCoverage(slices: GoalSummaryChartSlice[]) {
  if (slices.length === 0) return 0;

  const totalWeight = slices.reduce((sum, slice) => {
    const target =
      slice.personalGoal?.target_amount_inr ?? slice.familyGoal?.target_amount_inr ?? 0;
    return sum + Math.max(target, 0);
  }, 0);

  if (totalWeight <= 0) {
    const average = slices.reduce((sum, slice) => sum + slice.progress, 0) / slices.length;
    return Math.round(average);
  }

  const weighted = slices.reduce((sum, slice) => {
    const target =
      slice.personalGoal?.target_amount_inr ?? slice.familyGoal?.target_amount_inr ?? 0;
    return sum + slice.progress * Math.max(target, 0);
  }, 0);

  return Math.round(weighted / totalWeight);
}

export function goalSummarySliceColor(slug?: string | null, kind: "personal" | "family" = "personal") {
  if (kind === "family") return GOAL_SUMMARY_SLICE_COLORS.family;
  if (!slug) return GOAL_SUMMARY_SLICE_COLORS.custom;
  return GOAL_SUMMARY_SLICE_COLORS[slug] ?? GOAL_SUMMARY_SLICE_COLORS.custom;
}

function buildSliceEntries(
  personalGoals: Goal[],
  familyGoals: DashboardFamilyGoal[],
): Array<{ target: number; slice: GoalSummaryChartSlice }> {
  const personalEntries = personalGoals
    .filter((goal) => goal.status !== "archived")
    .map((goal) => {
      const progress = resolveGoalProgress(goal);
      const covered = isGoalCovered(goal);
      return {
        target: Math.max(goal.target_amount_inr, 0),
        slice: {
          id: goal.id,
          label: goal.title,
          value: 0,
          fill: covered
            ? goalSummarySliceColor(goal.template?.slug, "personal")
            : "color-mix(in srgb, var(--muted-foreground) 28%, transparent)",
          covered,
          progress,
          kind: "personal" as const,
          personalGoal: goal,
        },
      };
    });

  const familyEntries = familyGoals
    .filter((goal) => goal.status !== "archived")
    .map((goal) => {
      const progress = resolveFamilyGoalProgress(goal);
      const covered = isFamilyGoalCovered(goal);
      return {
        target: Math.max(goal.target_amount_inr, 0),
        slice: {
          id: `${goal.family_group_id}-${goal.id}`,
          label: goal.title,
          value: 0,
          fill: covered
            ? goalSummarySliceColor(goal.template?.slug ?? "family", "family")
            : "color-mix(in srgb, var(--muted-foreground) 28%, transparent)",
          covered,
          progress,
          kind: "family" as const,
          familyGoal: goal,
        },
      };
    });

  return [...personalEntries, ...familyEntries];
}

export function buildGoalSummaryChartData(goals: Goal[]): GoalSummaryChartSlice[] {
  return buildCombinedGoalSummaryChartData(goals, []);
}

export function buildCombinedGoalSummaryChartData(
  personalGoals: Goal[],
  familyGoals: DashboardFamilyGoal[],
): GoalSummaryChartSlice[] {
  const entries = buildSliceEntries(personalGoals, familyGoals);
  if (entries.length === 0) return [];

  const totalTarget = entries.reduce((sum, entry) => sum + entry.target, 0);
  const equalShare = 100 / entries.length;

  return entries.map(({ target, slice }) => ({
    ...slice,
    value: totalTarget > 0 ? (target / totalTarget) * 100 : equalShare,
  }));
}

export function countCoveredSummarySlices(slices: GoalSummaryChartSlice[]) {
  return slices.filter((slice) => slice.covered).length;
}
