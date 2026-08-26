import { apiRequest } from "@/lib/api-client";

export type GoalStatus = "draft" | "active" | "achieved" | "paused" | "archived";

export type GoalTemplate = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  icon_key: string;
  image_url?: string | null;
  default_tenure_months: number;
  suggested_return_pct?: number | null;
  is_active: boolean;
  sort_order: number;
};

export type Goal = {
  id: string;
  user_id: string;
  family_group_id?: string | null;
  template_id?: string | null;
  template?: GoalTemplate | null;
  title: string;
  tag?: string | null;
  priority: number;
  target_amount_inr: number;
  target_date: string;
  current_amount_inr: number;
  existing_savings_inr: number;
  expected_return_pct?: number | null;
  status: GoalStatus;
  progress_pct: number;
  linked_product_id?: string | null;
  linked_product_name?: string | null;
  holdings_value_inr?: number | null;
  invested_via_orders_inr?: number | null;
  linked_sip_monthly_inr?: number | null;
  effective_current_amount_inr?: number | null;
  effective_progress_pct?: number | null;
  projected_value_inr?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type GoalCalculatorResult = {
  target_amount_inr: number;
  target_date: string;
  duration_months: number;
  existing_savings_inr: number;
  expected_return_pct: number;
  required_monthly_sip_inr: number;
  required_lumpsum_inr: number;
  projected_value_inr: number;
  progress_pct: number;
  milestones: Array<{
    date: string;
    month_offset: number;
    projected_value_inr: number;
  }>;
};

export type CreateGoalInput = {
  title: string;
  target_amount_inr: number;
  target_date: string;
  template_id?: string;
  tag?: string;
  priority?: number;
  existing_savings_inr?: number;
  expected_return_pct?: number;
  status?: "draft" | "active";
  linked_product_id?: string;
};

export type UpdateGoalInput = {
  title?: string;
  tag?: string;
  priority?: number;
  target_amount_inr?: number;
  target_date?: string;
  existing_savings_inr?: number;
  current_amount_inr?: number;
  expected_return_pct?: number;
  status?: GoalStatus;
  linked_product_id?: string;
  clear_linked_product?: boolean;
};

export type CalculateGoalInput = {
  target_amount_inr: number;
  target_date: string;
  existing_savings_inr?: number;
  expected_return_pct?: number;
};

export async function fetchGoalTemplates() {
  return apiRequest<{ items: GoalTemplate[] }>("/goals/templates");
}

export async function fetchMyGoals(includeArchived = false) {
  const query = includeArchived ? "?include_archived=true" : "";
  return apiRequest<{ items: Goal[]; limit: number; active_count: number }>(`/goals/me${query}`);
}

export async function fetchGoal(goalId: string) {
  return apiRequest<Goal>(`/goals/${goalId}`);
}

export async function calculateGoal(input: CalculateGoalInput) {
  return apiRequest<GoalCalculatorResult>("/goals/calculate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createGoal(input: CreateGoalInput) {
  return apiRequest<Goal>("/goals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateGoal(goalId: string, input: UpdateGoalInput) {
  return apiRequest<Goal>(`/goals/${goalId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function archiveGoal(goalId: string) {
  return apiRequest<Goal>(`/goals/${goalId}`, {
    method: "DELETE",
  });
}

export async function restoreGoal(goalId: string) {
  return apiRequest<Goal>(`/goals/${goalId}/restore`, {
    method: "POST",
  });
}

export async function deleteGoalPermanently(goalId: string) {
  return apiRequest<void>(`/goals/${goalId}/permanent`, {
    method: "DELETE",
  });
}

export type LinkableFamilyGoal = {
  goal_id: string;
  goal_title: string;
  target_amount_inr: number;
  progress_pct: number;
  group_id: string;
  group_title: string;
  group_avatar_url?: string | null;
  my_role: string;
  can_create_goals: boolean;
};

export async function fetchLinkableFamilyGoals() {
  return apiRequest<{ items: LinkableFamilyGoal[] }>("/goals/family/linkable");
}
