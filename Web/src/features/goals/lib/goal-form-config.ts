import {
  GOAL_DEFAULT_PRIORITY,
  GOAL_DEFAULT_RETURN_PCT,
  GOAL_MAX_DURATION_MONTHS,
  GOAL_MAX_PRIORITY,
  GOAL_MAX_RETURN_PCT,
  GOAL_MAX_TARGET_AMOUNT,
  GOAL_MIN_EXISTING_SAVINGS,
  GOAL_MIN_PRIORITY,
  GOAL_MIN_RETURN_PCT,
  GOAL_MIN_TARGET_AMOUNT,
  GOAL_RETURN_STEP,
} from "@/features/goals/lib/goal-calculator";
import { goalTemplateFormConfigFor } from "@/features/goals/lib/goal-template-meta";
import { copy } from "@/shared/config/copy";

export type GoalFormConfig = {
  defaultTargetAmountInr: number;
  sliderMinTargetAmountInr: number;
  sliderMaxTargetAmountInr: number;
  minTargetAmountInr: number;
  maxTargetAmountInr: number;
  minExistingSavingsInr: number;
  maxExistingSavingsInr: number;
  defaultExistingSavingsInr: number;
  defaultExpectedReturnPct: number;
  minExpectedReturnPct: number;
  maxExpectedReturnPct: number;
  expectedReturnStep: number;
  defaultPriority: number;
  minPriority: number;
  maxPriority: number;
  maxDurationMonths: number;
  existingSavingsLabel: string;
};

const DEFAULT_FORM_CONFIG = {
  defaultTargetAmountInr: 500_000,
  sliderMinTargetAmountInr: 10_000,
  sliderMaxTargetAmountInr: 50_00_000,
  minTargetAmountInr: GOAL_MIN_TARGET_AMOUNT,
  maxTargetAmountInr: GOAL_MAX_TARGET_AMOUNT,
  minExistingSavingsInr: GOAL_MIN_EXISTING_SAVINGS,
  maxExistingSavingsInr: GOAL_MAX_TARGET_AMOUNT,
  defaultExistingSavingsInr: 0,
  defaultExpectedReturnPct: GOAL_DEFAULT_RETURN_PCT,
  minExpectedReturnPct: GOAL_MIN_RETURN_PCT,
  maxExpectedReturnPct: GOAL_MAX_RETURN_PCT,
  expectedReturnStep: GOAL_RETURN_STEP,
  defaultPriority: GOAL_DEFAULT_PRIORITY,
  minPriority: GOAL_MIN_PRIORITY,
  maxPriority: GOAL_MAX_PRIORITY,
  maxDurationMonths: GOAL_MAX_DURATION_MONTHS,
  existingSavingsLabel: copy.goals.existingSavingsLabel,
} satisfies Omit<GoalFormConfig, never>;

export function getGoalFormConfig(templateSlug?: string | null): GoalFormConfig {
  const templateConfig = templateSlug ? goalTemplateFormConfigFor(templateSlug) : null;

  return {
    ...DEFAULT_FORM_CONFIG,
    defaultTargetAmountInr: templateConfig?.defaultTargetAmountInr ?? DEFAULT_FORM_CONFIG.defaultTargetAmountInr,
    sliderMinTargetAmountInr:
      templateConfig?.sliderMinTargetAmountInr ?? DEFAULT_FORM_CONFIG.sliderMinTargetAmountInr,
    sliderMaxTargetAmountInr:
      templateConfig?.sliderMaxTargetAmountInr ?? DEFAULT_FORM_CONFIG.sliderMaxTargetAmountInr,
    defaultExpectedReturnPct:
      templateConfig?.defaultExpectedReturnPct ?? DEFAULT_FORM_CONFIG.defaultExpectedReturnPct,
    defaultPriority: templateConfig?.defaultPriority ?? DEFAULT_FORM_CONFIG.defaultPriority,
    existingSavingsLabel: templateConfig?.usesDownPaymentLabel
      ? copy.goals.downPaymentLabel
      : copy.goals.amountSavedLabel,
  };
}
