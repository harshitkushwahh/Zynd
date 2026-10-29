import {
  fetchFamilyGroup,
  fetchFamilyGroupGoals,
  fetchFamilyGroups,
  type FamilyGoal,
  type FamilyGroupMemberPreview,
  type FamilyGroupSummary,
} from "@/features/family-groups/api/family-groups-api";

export const FAMILY_GOAL_CARD_MEMBER_AVATAR_LIMIT = 5;

export type DashboardFamilyGoal = FamilyGoal & {
  groupTitle: string;
  groupAvatarUrl?: string | null;
  groupMemberCount: number;
  groupMembers: FamilyGroupMemberPreview[];
};

export async function buildDashboardFamilyGoals(
  groups: FamilyGroupSummary[],
): Promise<DashboardFamilyGoal[]> {
  const activeGroups = groups.filter((group) => group.status === "active");

  const results = await Promise.all(
    activeGroups.map(async (group) => {
      try {
        const [goalsResponse, groupDetail] = await Promise.all([
          fetchFamilyGroupGoals(group.id),
          fetchFamilyGroup(group.id),
        ]);
        const groupMembers = groupDetail.members.slice(0, FAMILY_GOAL_CARD_MEMBER_AVATAR_LIMIT);
        const groupMemberCount = groupDetail.member_count ?? groupDetail.members.length;

        return goalsResponse.items
          .filter((goal) => goal.status !== "archived")
          .map((goal) => ({
            ...goal,
            groupTitle: group.title,
            groupAvatarUrl: group.avatar_url ?? null,
            groupMemberCount,
            groupMembers,
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
