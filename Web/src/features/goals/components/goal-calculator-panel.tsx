"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, CalendarDays, Tag, TrendingUp, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  calculateGoal,
  type GoalCalculatorResult,
  type GoalTemplate,
} from "@/features/goals/api/goals-api";
import { GoalCalculatorResults } from "@/features/goals/components/goal-calculator-results";
import { GoalDialogSplitLayout } from "@/features/goals/components/goal-dialog-layout";
import {
  GoalFamilyGroupSelect,
  GOAL_FAMILY_GROUP_NONE,
  resolveGoalFamilyGroupId,
} from "@/features/goals/components/goal-family-group-select";
import { GoalPriorityBadgePicker } from "@/features/goals/components/goal-priority-badge-picker";
import { GoalSliderInputField } from "@/features/goals/components/goal-slider-input-field";
import {
  clampGoalAmount,
  clampGoalExistingSavings,
  clampGoalReturn,
  defaultTargetDate,
  goalAmountStep,
  goalExistingSavingsStep,
} from "@/features/goals/lib/goal-calculator";
import { formatGoalPanelInr } from "@/features/goals/lib/goal-display-format";
import { getGoalFormConfig } from "@/features/goals/lib/goal-form-config";
import { goalTemplateTagPlaceholderFor, goalTemplateThemeFor, type GoalTemplateTheme } from "@/features/goals/lib/goal-template-meta";
import { normalizeGoalPriority, validateGoalForm, hasGoalFormErrors, type GoalFormFieldErrors } from "@/features/goals/lib/goal-validation";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const GOAL_CALCULATOR_DEBOUNCE_MS = 350;

export type GoalCalculatorSaveInput = {
  target_amount_inr: number;
  target_date: string;
  existing_savings_inr: number;
  expected_return_pct: number;
  priority: number;
  tag?: string;
  family_group_id?: string;
};

export type GoalCustomSaveInput = GoalCalculatorSaveInput & {
  title: string;
};

type GoalCalculatorPanelProps = {
  selectedTemplate?: GoalTemplate | null;
  initialTargetAmount?: number;
  initialTargetDate?: string;
  initialExistingSavings?: number;
  initialExpectedReturn?: number;
  initialPriority?: number;
  initialTag?: string;
  layout?: "card" | "embedded" | "template-dialog" | "custom-dialog";
  formId?: string;
  saveFooter?: "inline" | "external";
  onCalculated?: (result: GoalCalculatorResult) => void;
  onSaveTemplate?: (input: GoalCalculatorSaveInput) => Promise<void>;
  onSaveCustom?: (input: GoalCustomSaveInput) => Promise<void>;
  savingTemplate?: boolean;
  saveTemplateError?: string;
  savingCustom?: boolean;
  saveCustomError?: string;
};

export function GoalCalculatorPanel({
  selectedTemplate,
  initialTargetAmount,
  initialTargetDate,
  initialExistingSavings = 0,
  initialExpectedReturn,
  initialPriority,
  initialTag = "",
  layout = "card",
  formId,
  saveFooter = "inline",
  onCalculated,
  onSaveTemplate,
  onSaveCustom,
  savingTemplate = false,
  saveTemplateError = "",
  savingCustom = false,
  saveCustomError = "",
}: GoalCalculatorPanelProps) {
  const formConfig = useMemo(
    () => getGoalFormConfig(selectedTemplate?.slug),
    [selectedTemplate?.slug],
  );

  const [targetAmount, setTargetAmount] = useState(
    initialTargetAmount ?? formConfig.defaultTargetAmountInr,
  );
  const [targetDate, setTargetDate] = useState(
    initialTargetDate ?? defaultTargetDate(selectedTemplate?.default_tenure_months ?? 60),
  );
  const [existingSavings, setExistingSavings] = useState(initialExistingSavings);
  const [expectedReturn, setExpectedReturn] = useState(
    selectedTemplate?.suggested_return_pct ??
      initialExpectedReturn ??
      formConfig.defaultExpectedReturnPct,
  );
  const [priority, setPriority] = useState(
    String(normalizeGoalPriority(initialPriority ?? formConfig.defaultPriority)),
  );
  const [tag, setTag] = useState(initialTag);
  const [customTitle, setCustomTitle] = useState("");
  const [customFieldErrors, setCustomFieldErrors] = useState<GoalFormFieldErrors>({});
  const [familyGroupId, setFamilyGroupId] = useState(GOAL_FAMILY_GROUP_NONE);
  const [result, setResult] = useState<GoalCalculatorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const existingSavingsMax = Math.min(formConfig.maxExistingSavingsInr, targetAmount);
  const isCustomDialog = layout === "custom-dialog";
  const isTemplateDialog = layout === "template-dialog";
  const isJourneyDialog = isTemplateDialog || isCustomDialog;
  const journeySaving = isCustomDialog ? savingCustom : savingTemplate;
  const journeySaveError = isCustomDialog ? saveCustomError : saveTemplateError;
  const templateTheme = useMemo(
    () =>
      isJourneyDialog
        ? goalTemplateThemeFor(isCustomDialog ? "custom" : (selectedTemplate?.slug ?? "custom"))
        : null,
    [isCustomDialog, isJourneyDialog, selectedTemplate?.slug],
  );
  const showSaveControls = Boolean(
    (selectedTemplate && onSaveTemplate) || (isCustomDialog && onSaveCustom),
  );
  const useExternalFooter = saveFooter === "external";

  useEffect(() => {
    setTargetAmount(initialTargetAmount ?? formConfig.defaultTargetAmountInr);
    setTargetDate(
      initialTargetDate ?? defaultTargetDate(selectedTemplate?.default_tenure_months ?? 60),
    );
    setExistingSavings(initialExistingSavings);
    setExpectedReturn(
      selectedTemplate?.suggested_return_pct ??
        initialExpectedReturn ??
        formConfig.defaultExpectedReturnPct,
    );
    setPriority(String(normalizeGoalPriority(initialPriority ?? formConfig.defaultPriority)));
    setTag(initialTag);
    setCustomTitle("");
    setCustomFieldErrors({});
    setFamilyGroupId(GOAL_FAMILY_GROUP_NONE);
    setResult(null);
    setError("");
  }, [
    formConfig.defaultExpectedReturnPct,
    formConfig.defaultPriority,
    formConfig.defaultTargetAmountInr,
    initialExistingSavings,
    initialExpectedReturn,
    initialPriority,
    initialTag,
    initialTargetAmount,
    initialTargetDate,
    selectedTemplate,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setError("");
          const payload = await calculateGoal({
            target_amount_inr: targetAmount,
            target_date: targetDate,
            existing_savings_inr: existingSavings,
            expected_return_pct: expectedReturn,
          });
          if (cancelled) return;
          setResult(payload);
          onCalculated?.(payload);
        } catch (err) {
          if (cancelled) return;
          const message = err instanceof Error ? err.message.trim() : "";
          setError(message || copy.goals.calculatorCalculateError);
          setResult(null);
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
    }, GOAL_CALCULATOR_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [targetAmount, targetDate, existingSavings, expectedReturn, onCalculated]);

  async function handleSaveTemplate() {
    if (!selectedTemplate || !onSaveTemplate) return;
    await onSaveTemplate({
      target_amount_inr: clampGoalAmount(targetAmount),
      target_date: targetDate,
      existing_savings_inr: clampGoalExistingSavings(existingSavings, targetAmount),
      expected_return_pct: clampGoalReturn(expectedReturn),
      priority: normalizeGoalPriority(Number(priority)),
      tag: tag.trim() || undefined,
      family_group_id: resolveGoalFamilyGroupId(familyGroupId),
    });
  }

  async function handleSaveCustom() {
    if (!onSaveCustom) return;
    const validation = validateGoalForm({
      title: customTitle,
      target_amount_inr: targetAmount,
      target_date: targetDate,
      existing_savings_inr: existingSavings,
      expected_return_pct: expectedReturn,
      priority: Number(priority),
    });
    setCustomFieldErrors(validation);
    if (hasGoalFormErrors(validation)) return;

    await onSaveCustom({
      title: customTitle.trim(),
      target_amount_inr: clampGoalAmount(targetAmount),
      target_date: targetDate,
      existing_savings_inr: clampGoalExistingSavings(existingSavings, targetAmount),
      expected_return_pct: clampGoalReturn(expectedReturn),
      priority: normalizeGoalPriority(Number(priority)),
      tag: tag.trim() || undefined,
      family_group_id: resolveGoalFamilyGroupId(familyGroupId),
    });
  }

  async function handleSaveJourney() {
    if (isCustomDialog) {
      await handleSaveCustom();
      return;
    }
    await handleSaveTemplate();
  }

  const amountStep = goalAmountStep(targetAmount);
  const savingsStep = goalExistingSavingsStep(existingSavings);
  const sliderDensity = isJourneyDialog ? "compact" : "default";

  function templateSliderProps(theme: GoalTemplateTheme | null) {
    if (!theme) return {};
    return {
      indicatorClassName: theme.sliderIndicatorClass,
      valueClassName: theme.accentTextClass,
      iconClassName: theme.accentIconClass,
      sliderClassName: theme.sliderThumbClass,
    };
  }

  const themedSliderProps = isJourneyDialog ? templateSliderProps(templateTheme) : {};

  const inputFields = (
    <>
      <GoalSliderInputField
        id="goal-target-amount"
        label={copy.goals.targetAmountLabel}
        value={targetAmount}
        valueDisplay={formatInr(targetAmount, { compact: true })}
        min={formConfig.sliderMinTargetAmountInr}
        max={formConfig.sliderMaxTargetAmountInr}
        step={amountStep}
        density={sliderDensity}
        minLabel={formatInr(formConfig.sliderMinTargetAmountInr, { compact: true })}
        maxLabel={formatInr(formConfig.sliderMaxTargetAmountInr, { compact: true })}
        onChange={(nextValue) => {
          const clamped = clampGoalAmount(nextValue);
          setTargetAmount(clamped);
          setExistingSavings((current) => clampGoalExistingSavings(current, clamped));
        }}
        {...themedSliderProps}
      />

      <div className="space-y-2">
        <Label htmlFor="goal-target-date" className={isJourneyDialog ? "text-compact" : undefined}>
          {copy.goals.targetDateLabel}
        </Label>
        {isJourneyDialog ? (
          <div className="relative">
            <CalendarDays
              className={cn(
                "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
                templateTheme?.accentIconClass ?? "text-muted-foreground",
              )}
              aria-hidden
            />
            <Input
              id="goal-target-date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className={cn(
                "h-10 pl-10 [color-scheme:light] dark:[color-scheme:dark]",
                templateTheme?.inputFocusClass,
              )}
            />
          </div>
        ) : (
          <Input
            id="goal-target-date"
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        )}
      </div>

      <div className={cn(isJourneyDialog && "grid gap-4 sm:grid-cols-2")}>
        <GoalSliderInputField
          id="goal-existing-savings"
          label={formConfig.existingSavingsLabel}
          value={existingSavings}
          valueDisplay={formatInr(existingSavings, { compact: true })}
          min={formConfig.minExistingSavingsInr}
          max={Math.max(existingSavingsMax, formConfig.minExistingSavingsInr)}
          step={savingsStep}
          density={sliderDensity}
          variant={isJourneyDialog ? "card" : "default"}
          icon={Wallet}
          infoTooltip={
            formConfig.existingSavingsLabel === copy.goals.downPaymentLabel
              ? copy.goals.calculatorExistingSavingsTooltipDownPayment
              : copy.goals.calculatorExistingSavingsTooltipDefault
          }
          minLabel={formatInr(formConfig.minExistingSavingsInr, { compact: true })}
          maxLabel={formatInr(existingSavingsMax, { compact: true })}
          onChange={(nextValue) => {
            setExistingSavings(clampGoalExistingSavings(nextValue, targetAmount));
          }}
          {...themedSliderProps}
        />

        <GoalSliderInputField
          id="goal-expected-return"
          label={copy.goals.expectedReturnLabel}
          value={expectedReturn}
          valueDisplay={`${expectedReturn}%`}
          min={formConfig.minExpectedReturnPct}
          max={formConfig.maxExpectedReturnPct}
          step={formConfig.expectedReturnStep}
          density={sliderDensity}
          variant={isJourneyDialog ? "card" : "default"}
          icon={TrendingUp}
          infoTooltip={copy.goals.calculatorExpectedReturnTooltip}
          minLabel={`${formConfig.minExpectedReturnPct}%`}
          maxLabel={`${formConfig.maxExpectedReturnPct}%`}
          onChange={(nextValue) => {
            setExpectedReturn(clampGoalReturn(nextValue));
          }}
          {...themedSliderProps}
        />
      </div>

      {showSaveControls ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="goal-template-priority" className={isJourneyDialog ? "text-compact" : undefined}>
              {copy.goals.priorityLabel}
            </Label>
            <GoalPriorityBadgePicker
              id="goal-template-priority"
              value={priority}
              onChange={setPriority}
              disabled={journeySaving || loading}
              variant={isJourneyDialog ? "segmented" : "badges"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-template-tag" className={isJourneyDialog ? "text-compact" : undefined}>
              {copy.goals.tagOptionalLabel}
            </Label>
            <div className="relative">
              <Tag
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
                  templateTheme?.accentIconClass ?? "text-muted-foreground",
                )}
                aria-hidden
              />
              <Input
                id="goal-template-tag"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                placeholder={
                  isCustomDialog
                    ? goalTemplateTagPlaceholderFor("custom")
                    : selectedTemplate
                      ? goalTemplateTagPlaceholderFor(selectedTemplate.slug)
                      : copy.goals.tagPlaceholder
                }
                maxLength={32}
                className={cn(
                  isJourneyDialog ? "h-10 pl-10" : "pl-10",
                  templateTheme?.inputFocusClass,
                )}
              />
            </div>
          </div>

          <GoalFamilyGroupSelect
            id="goal-template-family-group"
            value={familyGroupId}
            onValueChange={setFamilyGroupId}
            disabled={journeySaving || loading}
            variant={isJourneyDialog ? "template-dialog" : "default"}
          />
        </>
      ) : null}

      {journeySaveError ? <FieldMessage message={journeySaveError} className="mt-0" /> : null}
      {error ? <FieldMessage message={error} className="mt-0" /> : null}
    </>
  );

  const resultsPanel = (
    <GoalCalculatorResults
      result={result}
      loading={loading}
      variant={isJourneyDialog ? "sidebar" : "stack"}
      accentTheme={isJourneyDialog ? templateTheme : null}
      customSidebarTitle={
        isCustomDialog
          ? {
              value: customTitle,
              onChange: setCustomTitle,
              error: customFieldErrors.title,
              inputId: "goal-custom-title",
            }
          : null
      }
      templateIllustration={
        isTemplateDialog && selectedTemplate
          ? {
              slug: selectedTemplate.slug,
              iconKey: selectedTemplate.icon_key,
              imageUrl: selectedTemplate.image_url,
            }
          : null
      }
      className="min-h-0 flex-1"
    />
  );

  const inlineResults = !isJourneyDialog && result ? (
    <div
      className={cn(
        "grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2",
        loading && "opacity-70",
      )}
    >
      <div>
        <p className="text-compact text-muted-foreground">{copy.goals.requiredSipLabel}</p>
        <p className="truncate text-lg font-semibold tabular-nums" title={formatGoalPanelInr(result.required_monthly_sip_inr)}>
          {formatGoalPanelInr(result.required_monthly_sip_inr)}
        </p>
      </div>
      <div>
        <p className="text-compact text-muted-foreground">{copy.goals.requiredLumpsumLabel}</p>
        <p className="truncate text-lg font-semibold tabular-nums" title={formatGoalPanelInr(result.required_lumpsum_inr)}>
          {formatGoalPanelInr(result.required_lumpsum_inr)}
        </p>
      </div>
      <div>
        <p className="text-compact text-muted-foreground">{copy.goals.projectedValueLabel}</p>
        <p className="truncate text-lg font-semibold tabular-nums" title={formatGoalPanelInr(result.projected_value_inr)}>
          {formatGoalPanelInr(result.projected_value_inr)}
        </p>
      </div>
      <div>
        <p className="text-compact text-muted-foreground">{copy.goals.durationLabel}</p>
        <p className="text-lg font-semibold">{copy.goals.monthsLabel(result.duration_months)}</p>
      </div>
    </div>
  ) : null;

  const inlineLoading = !isJourneyDialog && loading && !result ? (
    <p className="text-compact text-muted-foreground">{copy.goals.calculatorLoading}</p>
  ) : null;

  const saveSection =
    showSaveControls && !useExternalFooter ? (
      <div className="space-y-2 border-t border-border/70 pt-4">
        <Button
          type="button"
          className="w-full"
          disabled={journeySaving || loading}
          onClick={() => void handleSaveJourney()}
        >
          {journeySaving ? copy.goals.loading : copy.goals.saveAction}
        </Button>
      </div>
    ) : null;

  const calculatorBody = (
    <div className={cn(isJourneyDialog ? "space-y-4" : "space-y-5")}>
      {inputFields}
      {inlineLoading}
      {inlineResults}
      {saveSection}
    </div>
  );

  if (isJourneyDialog) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-popover">
        <GoalDialogSplitLayout
          main={
            <form
              id={formId}
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveJourney();
              }}
            >
              {inputFields}
            </form>
          }
          aside={resultsPanel}
        />
      </div>
    );
  }

  if (layout === "embedded") {
    return calculatorBody;
  }

  return (
    <Card className="border border-border shadow-none ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="size-5" aria-hidden />
          {selectedTemplate ? selectedTemplate.name : copy.goals.calculatorTitle}
        </CardTitle>
        <CardDescription>
          {selectedTemplate?.description ?? copy.goals.calculatorDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>{calculatorBody}</CardContent>
    </Card>
  );
}
