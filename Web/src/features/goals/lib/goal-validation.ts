import {
  GOAL_MAX_DURATION_MONTHS,
  GOAL_MAX_PRIORITY,
  GOAL_MAX_RETURN_PCT,
  GOAL_MAX_TARGET_AMOUNT,
  GOAL_MIN_PRIORITY,
  GOAL_MIN_RETURN_PCT,
  GOAL_MIN_TARGET_AMOUNT,
  monthsUntil,
} from "@/features/goals/lib/goal-calculator";

export type GoalFormFieldErrors = {
  title?: string;
  target_amount_inr?: string;
  target_date?: string;
  existing_savings_inr?: string;
  expected_return_pct?: string;
  priority?: string;
};

export function validateGoalForm(input: {
  title: string;
  target_amount_inr: number;
  target_date: string;
  existing_savings_inr?: number;
  expected_return_pct?: number;
  priority?: number;
}): GoalFormFieldErrors {
  const errors: GoalFormFieldErrors = {};
  const title = input.title.trim();
  if (!title) {
    errors.title = "Goal name is required.";
  } else if (title.length > 80) {
    errors.title = "Goal name must be at most 80 characters.";
  }

  if (!Number.isFinite(input.target_amount_inr) || input.target_amount_inr < GOAL_MIN_TARGET_AMOUNT) {
    errors.target_amount_inr = `Enter a target amount of at least ₹${GOAL_MIN_TARGET_AMOUNT.toLocaleString("en-IN")}.`;
  } else if (input.target_amount_inr > GOAL_MAX_TARGET_AMOUNT) {
    errors.target_amount_inr = `Target amount cannot exceed ₹${GOAL_MAX_TARGET_AMOUNT.toLocaleString("en-IN")}.`;
  }

  const targetDate = new Date(input.target_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(targetDate.getTime())) {
    errors.target_date = "Enter a valid target date.";
  } else if (targetDate <= today) {
    errors.target_date = "Target date must be in the future.";
  } else {
    const durationMonths = monthsUntil(input.target_date);
    if (durationMonths < 1) {
      errors.target_date = "Target date must be at least one month in the future.";
    } else if (durationMonths > GOAL_MAX_DURATION_MONTHS) {
      errors.target_date = `Target date cannot be more than ${GOAL_MAX_DURATION_MONTHS} months away.`;
    }
  }

  if (input.existing_savings_inr != null) {
    if (!Number.isFinite(input.existing_savings_inr) || input.existing_savings_inr < 0) {
      errors.existing_savings_inr = "Saved amount cannot be negative.";
    } else if (
      Number.isFinite(input.target_amount_inr) &&
      input.existing_savings_inr > input.target_amount_inr
    ) {
      errors.existing_savings_inr = "Saved amount cannot exceed the target amount.";
    }
  }

  if (input.expected_return_pct != null) {
    if (
      !Number.isFinite(input.expected_return_pct) ||
      input.expected_return_pct < GOAL_MIN_RETURN_PCT ||
      input.expected_return_pct > GOAL_MAX_RETURN_PCT
    ) {
      errors.expected_return_pct = `Expected return must be between ${GOAL_MIN_RETURN_PCT}% and ${GOAL_MAX_RETURN_PCT}%.`;
    }
  }

  if (input.priority != null) {
    if (
      !Number.isFinite(input.priority) ||
      input.priority < GOAL_MIN_PRIORITY ||
      input.priority > GOAL_MAX_PRIORITY
    ) {
      errors.priority = `Priority must be between ${GOAL_MIN_PRIORITY} and ${GOAL_MAX_PRIORITY}.`;
    }
  }

  return errors;
}

export function hasGoalFormErrors(errors: GoalFormFieldErrors) {
  return Object.values(errors).some(Boolean);
}

export function normalizeGoalPriority(priority: number) {
  return Math.min(Math.max(Math.round(priority), GOAL_MIN_PRIORITY), GOAL_MAX_PRIORITY);
}
