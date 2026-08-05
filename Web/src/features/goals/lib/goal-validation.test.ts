import { describe, expect, it } from "vitest";

import {
  GOAL_MAX_TARGET_AMOUNT,
  defaultTargetDate,
  monthsUntil,
} from "@/features/goals/lib/goal-calculator";
import {
  hasGoalFormErrors,
  normalizeGoalPriority,
  validateGoalForm,
} from "@/features/goals/lib/goal-validation";

describe("goal-validation", () => {
  it("requires title and future target date", () => {
    const errors = validateGoalForm({
      title: "",
      target_amount_inr: 0,
      target_date: "2020-01-01",
    });

    expect(errors.title).toBeTruthy();
    expect(errors.target_amount_inr).toBeTruthy();
    expect(errors.target_date).toBeTruthy();
    expect(hasGoalFormErrors(errors)).toBe(true);
  });

  it("accepts valid goal form values", () => {
    const errors = validateGoalForm({
      title: "Car fund",
      target_amount_inr: 500000,
      target_date: defaultTargetDate(24),
      existing_savings_inr: 50000,
      expected_return_pct: 12,
      priority: 2,
    });

    expect(hasGoalFormErrors(errors)).toBe(false);
  });

  it("rejects target amount above backend max", () => {
    const errors = validateGoalForm({
      title: "Retirement",
      target_amount_inr: GOAL_MAX_TARGET_AMOUNT + 1,
      target_date: defaultTargetDate(24),
    });

    expect(errors.target_amount_inr).toBeTruthy();
  });

  it("rejects existing savings above target amount", () => {
    const errors = validateGoalForm({
      title: "Home",
      target_amount_inr: 500000,
      target_date: defaultTargetDate(24),
      existing_savings_inr: 600000,
    });

    expect(errors.existing_savings_inr).toBeTruthy();
  });

  it("rejects invalid expected return", () => {
    const errors = validateGoalForm({
      title: "Travel",
      target_amount_inr: 200000,
      target_date: defaultTargetDate(24),
      expected_return_pct: 120,
    });

    expect(errors.expected_return_pct).toBeTruthy();
  });

  it("clamps priority into supported range", () => {
    expect(normalizeGoalPriority(0)).toBe(1);
    expect(normalizeGoalPriority(9)).toBe(5);
  });

  it("computes months until target date", () => {
    expect(monthsUntil(defaultTargetDate(24))).toBeGreaterThanOrEqual(23);
  });
});
