import { GOAL_MAX_PRIORITY, GOAL_MIN_PRIORITY } from "@/features/goals/lib/goal-calculator";

export type GoalFormFieldErrors = {
  title?: string;
  target_amount_inr?: string;
  target_date?: string;
};

export function validateGoalForm(input: {
  title: string;
  target_amount_inr: number;
  target_date: string;
}): GoalFormFieldErrors {
  const errors: GoalFormFieldErrors = {};
  const title = input.title.trim();
  if (!title) {
    errors.title = "Goal name is required.";
  } else if (title.length > 80) {
    errors.title = "Goal name must be at most 80 characters.";
  }

  if (!Number.isFinite(input.target_amount_inr) || input.target_amount_inr <= 0) {
    errors.target_amount_inr = "Enter a valid target amount.";
  }

  const targetDate = new Date(input.target_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(targetDate.getTime())) {
    errors.target_date = "Enter a valid target date.";
  } else if (targetDate <= today) {
    errors.target_date = "Target date must be in the future.";
  }

  return errors;
}

export function hasGoalFormErrors(errors: GoalFormFieldErrors) {
  return Boolean(errors.title || errors.target_amount_inr || errors.target_date);
}

export function normalizeGoalPriority(priority: number) {
  return Math.min(Math.max(Math.round(priority), GOAL_MIN_PRIORITY), GOAL_MAX_PRIORITY);
}
