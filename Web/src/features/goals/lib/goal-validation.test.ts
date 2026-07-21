import { describe, expect, it } from "vitest";

import {
  hasGoalFormErrors,
  normalizeGoalPriority,
  validateGoalForm,
} from "@/features/goals/lib/goal-validation";
import { defaultTargetDate } from "@/features/goals/lib/goal-calculator";

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
    });

    expect(hasGoalFormErrors(errors)).toBe(false);
  });

  it("clamps priority into supported range", () => {
    expect(normalizeGoalPriority(0)).toBe(1);
    expect(normalizeGoalPriority(9)).toBe(5);
  });
});
