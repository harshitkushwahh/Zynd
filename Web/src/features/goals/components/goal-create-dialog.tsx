"use client";

import { useEffect, useMemo, useState } from "react";
import { PenLine, Pencil, Target } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import type { CreateGoalInput, Goal, UpdateGoalInput } from "@/features/goals/api/goals-api";
import {
  GoalFamilyGroupSelect,
  GOAL_FAMILY_GROUP_NONE,
  resolveGoalFamilyGroupId,
} from "@/features/goals/components/goal-family-group-select";
import { GoalPriorityBadgePicker } from "@/features/goals/components/goal-priority-badge-picker";
import {
  GoalDialogBody,
  GoalDialogSection,
  GOAL_DIALOG_SHELL_CLASS,
} from "@/features/goals/components/goal-dialog-layout";
import { GoalSliderInputField } from "@/features/goals/components/goal-slider-input-field";
import {
  clampGoalAmount,
  clampGoalExistingSavings,
  clampGoalReturn,
  defaultTargetDate,
  goalAmountStep,
  goalExistingSavingsStep,
  GOAL_DEFAULT_RETURN_PCT,
} from "@/features/goals/lib/goal-calculator";
import { getGoalFormConfig } from "@/features/goals/lib/goal-form-config";
import {
  hasGoalFormErrors,
  normalizeGoalPriority,
  validateGoalForm,
  type GoalFormFieldErrors,
} from "@/features/goals/lib/goal-validation";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const GOAL_CREATE_FORM_ID = "goal-create-form";

type GoalCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal | null;
  onSubmit?: (input: CreateGoalInput & { family_group_id?: string }) => Promise<void>;
  onUpdate?: (input: UpdateGoalInput) => Promise<void>;
  submitting?: boolean;
  error?: string;
};

function resetCreateFormDefaults(
  formConfig: ReturnType<typeof getGoalFormConfig>,
  setters: {
    setTitle: (value: string) => void;
    setTag: (value: string) => void;
    setPriority: (value: string) => void;
    setTargetAmount: (value: number) => void;
    setTargetDate: (value: string) => void;
    setExistingSavings: (value: number) => void;
    setExpectedReturn: (value: number) => void;
    setFamilyGroupId: (value: string) => void;
    setFieldErrors: (value: GoalFormFieldErrors) => void;
  },
) {
  setters.setTitle("");
  setters.setTag("");
  setters.setPriority(String(formConfig.defaultPriority));
  setters.setTargetAmount(formConfig.defaultTargetAmountInr);
  setters.setTargetDate(defaultTargetDate());
  setters.setExistingSavings(formConfig.defaultExistingSavingsInr);
  setters.setExpectedReturn(formConfig.defaultExpectedReturnPct);
  setters.setFamilyGroupId(GOAL_FAMILY_GROUP_NONE);
  setters.setFieldErrors({});
}

function applyGoalToForm(
  goal: Goal,
  setters: {
    setTitle: (value: string) => void;
    setTag: (value: string) => void;
    setPriority: (value: string) => void;
    setTargetAmount: (value: number) => void;
    setTargetDate: (value: string) => void;
    setExistingSavings: (value: number) => void;
    setExpectedReturn: (value: number) => void;
    setFamilyGroupId: (value: string) => void;
    setFieldErrors: (value: GoalFormFieldErrors) => void;
  },
) {
  setters.setTitle(goal.title);
  setters.setTag(goal.tag ?? "");
  setters.setPriority(String(normalizeGoalPriority(goal.priority)));
  setters.setTargetAmount(goal.target_amount_inr);
  setters.setTargetDate(goal.target_date);
  setters.setExistingSavings(goal.existing_savings_inr);
  setters.setExpectedReturn(goal.expected_return_pct ?? GOAL_DEFAULT_RETURN_PCT);
  setters.setFamilyGroupId(goal.family_group_id ?? GOAL_FAMILY_GROUP_NONE);
  setters.setFieldErrors({});
}

export function GoalCreateDialog({
  open,
  onOpenChange,
  goal = null,
  onSubmit,
  onUpdate,
  submitting = false,
  error = "",
}: GoalCreateDialogProps) {
  const isEditMode = Boolean(goal);
  const formConfig = useMemo(() => getGoalFormConfig(goal?.template?.slug), [goal?.template?.slug]);

  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [priority, setPriority] = useState(String(formConfig.defaultPriority));
  const [targetAmount, setTargetAmount] = useState(formConfig.defaultTargetAmountInr);
  const [targetDate, setTargetDate] = useState(defaultTargetDate());
  const [existingSavings, setExistingSavings] = useState(formConfig.defaultExistingSavingsInr);
  const [expectedReturn, setExpectedReturn] = useState(formConfig.defaultExpectedReturnPct);
  const [familyGroupId, setFamilyGroupId] = useState(GOAL_FAMILY_GROUP_NONE);
  const [fieldErrors, setFieldErrors] = useState<GoalFormFieldErrors>({});

  const formSetters = {
    setTitle,
    setTag,
    setPriority,
    setTargetAmount,
    setTargetDate,
    setExistingSavings,
    setExpectedReturn,
    setFamilyGroupId,
    setFieldErrors,
  };

  useEffect(() => {
    if (!open) return;
    if (goal) {
      applyGoalToForm(goal, formSetters);
      return;
    }
    resetCreateFormDefaults(formConfig, formSetters);
  }, [open, goal, formConfig]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateGoalForm({
      title,
      target_amount_inr: targetAmount,
      target_date: targetDate,
      existing_savings_inr: existingSavings,
      expected_return_pct: expectedReturn,
      priority: Number(priority),
    });
    setFieldErrors(validation);
    if (hasGoalFormErrors(validation)) return;

    const payload = {
      title: title.trim(),
      target_amount_inr: clampGoalAmount(targetAmount),
      target_date: targetDate,
      tag: tag.trim() || undefined,
      priority: normalizeGoalPriority(Number(priority)),
      existing_savings_inr: clampGoalExistingSavings(existingSavings, targetAmount),
      expected_return_pct: clampGoalReturn(expectedReturn),
    };

    if (isEditMode && onUpdate) {
      await onUpdate(payload);
      return;
    }

    if (!onSubmit) return;

    await onSubmit({
      ...payload,
      family_group_id: resolveGoalFamilyGroupId(familyGroupId),
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isEditMode) {
      resetCreateFormDefaults(formConfig, formSetters);
    }
    onOpenChange(nextOpen);
  }

  const existingSavingsMax = Math.min(formConfig.maxExistingSavingsInr, targetAmount);

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={isEditMode ? copy.goals.editTitle : copy.goals.createTitle}
      description={isEditMode ? copy.goals.editDescription : copy.goals.createDescription}
      icon={isEditMode ? Pencil : Target}
      maxWidth="lg"
      headerDensity="compact"
      className={cn(GOAL_DIALOG_SHELL_CLASS, "max-w-xl")}
    >
      <GoalDialogBody>
        <form
          id={GOAL_CREATE_FORM_ID}
          className="space-y-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <GoalDialogSection
            title={copy.goals.createSectionBasicsTitle}
            description={copy.goals.createSectionBasicsDescription}
          >
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="goal-title" className="text-compact">
                  {copy.goals.titleLabel}
                </Label>
                <Input
                  id="goal-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={copy.goals.titlePlaceholder}
                  maxLength={80}
                  required
                  aria-invalid={Boolean(fieldErrors.title)}
                />
                {fieldErrors.title ? (
                  <FieldMessage message={fieldErrors.title} />
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-tag" className="text-compact">
                  {copy.goals.tagLabel}
                </Label>
                <Input
                  id="goal-tag"
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  placeholder={copy.goals.tagPlaceholder}
                  maxLength={32}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-priority" className="text-compact">
                  {copy.goals.priorityLabel}
                </Label>
                <GoalPriorityBadgePicker
                  id="goal-priority"
                  value={priority}
                  onChange={setPriority}
                  disabled={submitting}
                />
                {fieldErrors.priority ? (
                  <FieldMessage message={fieldErrors.priority} />
                ) : null}
              </div>
            </div>
          </GoalDialogSection>

          <GoalDialogSection
            title={copy.goals.createSectionTargetTitle}
            description={copy.goals.createSectionTargetDescription}
            tone="muted"
          >
            <div className="space-y-3">
              <GoalSliderInputField
                id="goal-create-target-amount"
                label={copy.goals.targetAmountLabel}
                value={targetAmount}
                valueDisplay={formatInr(targetAmount, { compact: true })}
                min={formConfig.sliderMinTargetAmountInr}
                max={formConfig.sliderMaxTargetAmountInr}
                step={goalAmountStep(targetAmount)}
                density="compact"
                minLabel={formatInr(formConfig.sliderMinTargetAmountInr, { compact: true })}
                maxLabel={formatInr(formConfig.sliderMaxTargetAmountInr, { compact: true })}
                onChange={(nextValue) => {
                  const clamped = clampGoalAmount(nextValue);
                  setTargetAmount(clamped);
                  setExistingSavings((current) => clampGoalExistingSavings(current, clamped));
                }}
              />
              {fieldErrors.target_amount_inr ? (
                <FieldMessage message={fieldErrors.target_amount_inr} />
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="goal-target-date" className="text-compact">
                  {copy.goals.targetDateLabel}
                </Label>
                <Input
                  id="goal-target-date"
                  type="date"
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.target_date)}
                />
                {fieldErrors.target_date ? (
                  <FieldMessage message={fieldErrors.target_date} />
                ) : null}
              </div>
            </div>
          </GoalDialogSection>

          <GoalDialogSection
            title={copy.goals.createSectionAssumptionsTitle}
            description={copy.goals.createSectionAssumptionsDescription}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <GoalSliderInputField
                id="goal-create-existing-savings"
                label={formConfig.existingSavingsLabel}
                value={existingSavings}
                valueDisplay={formatInr(existingSavings, { compact: true })}
                min={formConfig.minExistingSavingsInr}
                max={Math.max(existingSavingsMax, formConfig.minExistingSavingsInr)}
                step={goalExistingSavingsStep(existingSavings)}
                density="compact"
                minLabel={formatInr(formConfig.minExistingSavingsInr, { compact: true })}
                maxLabel={formatInr(existingSavingsMax, { compact: true })}
                onChange={(nextValue) => {
                  setExistingSavings(clampGoalExistingSavings(nextValue, targetAmount));
                }}
              />
              <GoalSliderInputField
                id="goal-create-expected-return"
                label={copy.goals.expectedReturnLabel}
                value={expectedReturn}
                valueDisplay={`${expectedReturn}%`}
                min={formConfig.minExpectedReturnPct}
                max={formConfig.maxExpectedReturnPct}
                step={formConfig.expectedReturnStep}
                density="compact"
                minLabel={`${formConfig.minExpectedReturnPct}%`}
                maxLabel={`${formConfig.maxExpectedReturnPct}%`}
                onChange={(nextValue) => {
                  setExpectedReturn(clampGoalReturn(nextValue));
                }}
              />
            </div>
            {fieldErrors.existing_savings_inr ? (
              <FieldMessage message={fieldErrors.existing_savings_inr} />
            ) : null}
            {fieldErrors.expected_return_pct ? (
              <FieldMessage message={fieldErrors.expected_return_pct} />
            ) : null}
          </GoalDialogSection>

          {!isEditMode ? (
            <GoalDialogSection
              title={copy.goals.createSectionSharingTitle}
              description={copy.goals.createSectionSharingDescription}
              tone="muted"
            >
              <GoalFamilyGroupSelect
                id="goal-create-family-group"
                value={familyGroupId}
                onValueChange={setFamilyGroupId}
                disabled={submitting}
              />
            </GoalDialogSection>
          ) : null}

          {error ? <FieldMessage message={error} className="mt-0" /> : null}
        </form>
      </GoalDialogBody>

      <BrandDialogFooter className="shrink-0">
        <div className="mr-auto hidden items-center gap-2 text-caption text-muted-foreground sm:flex">
          <PenLine className="size-3.5" aria-hidden />
          <span>{isEditMode ? copy.goals.editDescription : copy.goals.createDescription}</span>
        </div>
        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" form={GOAL_CREATE_FORM_ID} disabled={submitting}>
          {submitting ? copy.goals.loading : copy.goals.saveAction}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
