import { createFamilyGroupGoal } from "@/features/family-groups/api/family-groups-api";
import { createGoal, type CreateGoalInput } from "@/features/goals/api/goals-api";

export type SaveGoalInput = CreateGoalInput & {
  family_group_id?: string;
};

export async function savePersonalOrFamilyGoal(input: SaveGoalInput) {
  const { family_group_id, ...goalInput } = input;

  if (family_group_id) {
    return {
      kind: "family" as const,
      goal: await createFamilyGroupGoal(family_group_id, {
        title: goalInput.title,
        target_amount_inr: goalInput.target_amount_inr,
        target_date: goalInput.target_date,
        template_id: goalInput.template_id,
        tag: goalInput.tag,
        priority: goalInput.priority,
        existing_savings_inr: goalInput.existing_savings_inr,
        expected_return_pct: goalInput.expected_return_pct,
      }),
      familyGroupId: family_group_id,
    };
  }

  return {
    kind: "personal" as const,
    goal: await createGoal(goalInput),
  };
}
