import type { AdminUserGoal } from "@/lib/admin-api";

export type AdminGoalExpectedReturnSource = "template" | "custom" | "unset";

function returnPctMatches(left: number | null | undefined, right: number | null | undefined) {
  if (left == null || right == null) return false;
  return Math.abs(left - right) < 0.05;
}

export function getAdminGoalExpectedReturnSource(goal: AdminUserGoal): AdminGoalExpectedReturnSource {
  if (goal.expected_return_pct == null) return "unset";

  const templateReturn = goal.template?.suggested_return_pct;
  if (goal.template && returnPctMatches(goal.expected_return_pct, templateReturn)) {
    return "template";
  }

  return "custom";
}

export function getAdminGoalExpectedReturnHint(goal: AdminUserGoal) {
  const source = getAdminGoalExpectedReturnSource(goal);

  if (source === "template" && goal.template) {
    return `From ${goal.template.name} template · not portfolio return`;
  }

  if (source === "custom") {
    return "Set at goal creation · not portfolio return";
  }

  return "No planning rate saved on this goal";
}

export function goalHasLinkedInvestment(goal: AdminUserGoal) {
  return Boolean(
    goal.linked_product_id ||
      (goal.holdings_value_inr ?? 0) > 0 ||
      (goal.invested_via_orders_inr ?? 0) > 0 ||
      (goal.linked_sip_monthly_inr ?? 0) > 0,
  );
}

export function getAdminGoalPlanAssumptionNotice(goal: AdminUserGoal) {
  if (goalHasLinkedInvestment(goal)) {
    return "Expected return and projected value are planning estimates. They are not recalculated from live mutual fund performance.";
  }

  return "No mutual fund is linked or invested yet. Expected return comes from the goal plan (template or user input), and projected value is a calculator estimate—not actual portfolio performance.";
}
