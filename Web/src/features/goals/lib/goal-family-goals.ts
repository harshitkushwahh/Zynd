import {
  fetchFamilyGroupGoals,
  fetchFamilyGroups,
  type FamilyGoal,
  type FamilyGroupSummary,
} from "@/features/family-groups/api/family-groups-api";

export type DashboardFamilyGoal = FamilyGoal & {
  groupTitle: string;
};

export async function buildDashboardFamilyGoals(
  groups: FamilyGroupSummary[],
): Promise<DashboardFamilyGoal[]> {
  const activeGroups = groups.filter((group) => group.status === "active");

  const results = await Promise.all(
    activeGroups.map(async (group) => {
      try {
        const response = await fetchFamilyGroupGoals(group.id);
        return response.items
          .filter((goal) => goal.status !== "archived")
          .map((goal) => ({
            ...goal,
            groupTitle: group.title,
          }));
      } catch {
        return [];
      }
    }),
  );

  return results.flat();
}

export async function fetchDashboardFamilyGoals(): Promise<DashboardFamilyGoal[]> {
  const { items: groups } = await fetchFamilyGroups();
  return buildDashboardFamilyGoals(groups);
}

export function resolveFamilyGoalProgress(goal: FamilyGoal) {
  const saved = goal.effective_current_amount_inr ?? goal.current_amount_inr;
  if (goal.target_amount_inr <= 0) return 0;
  return Math.min((saved / goal.target_amount_inr) * 100, 100);
}
