import type { GoalSummaryChartSlice } from "@/features/goals/lib/goal-summary";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";

export function goalDetailHref(goalId: string) {
  return `/dashboard/goals/${goalId}`;
}

export function goalSummarySliceHref(slice: GoalSummaryChartSlice) {
  if (slice.kind === "personal" && slice.personalGoal) {
    return goalDetailHref(slice.personalGoal.id);
  }
  if (slice.kind === "family" && slice.familyGoal) {
    return buildFamilyGroupHref({
      id: slice.familyGoal.family_group_id,
      title: slice.familyGoal.groupTitle,
    });
  }
  return null;
}

export const GOALS_LIST_HREF = "/dashboard/goals";
export const GOALS_PERSONAL_LIST_HREF = "/dashboard/goals/personal";
export const GOALS_FAMILY_LIST_HREF = "/dashboard/goals/family";

export const GOALS_PERSONAL_PREVIEW_LIMIT = 3;
export const GOALS_FAMILY_PREVIEW_LIMIT = 2;
