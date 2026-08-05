"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import type { GoalTemplate } from "@/features/goals/api/goals-api";
import {
  GoalCalculatorPanel,
  type GoalCalculatorSaveInput,
} from "@/features/goals/components/goal-calculator-panel";
import { GOAL_DIALOG_SHELL_CLASS } from "@/features/goals/components/goal-dialog-layout";
import { defaultTargetDate } from "@/features/goals/lib/goal-calculator";
import { getGoalFormConfig } from "@/features/goals/lib/goal-form-config";
import { goalTemplateIconThemeFor } from "@/features/goals/lib/goal-template-meta";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { prefetchGoalTemplateIllustration } from "@/features/goals/lib/prefetch-goal-template-illustrations";
import { copy } from "@/shared/config/copy";

const GOAL_TEMPLATE_FORM_ID = "goal-template-journey-form";

type GoalTemplateJourneyDialogProps = {
  template: GoalTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: GoalCalculatorSaveInput) => Promise<void>;
  saving?: boolean;
  error?: string;
};

export function GoalTemplateJourneyDialog({
  template,
  open,
  onOpenChange,
  onSave,
  saving = false,
  error = "",
}: GoalTemplateJourneyDialogProps) {
  useEffect(() => {
    if (!open || !template) return;
    prefetchGoalTemplateIllustration(template.slug);
  }, [open, template]);

  if (!template) return null;

  const Icon = getGoalTemplateIcon(template.icon_key);
  const formConfig = getGoalFormConfig(template.slug);
  const theme = goalTemplateIconThemeFor(template.slug);

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={template.name}
      description={template.description ?? copy.goals.calculatorDescription}
      icon={Icon}
      maxWidth="xl"
      headerDensity="compact"
      headerVariant="light"
      closeTone="default"
      iconClassName={theme.headerIconClass}
      className={GOAL_DIALOG_SHELL_CLASS}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <GoalCalculatorPanel
          key={template.id}
          layout="template-dialog"
          formId={GOAL_TEMPLATE_FORM_ID}
          saveFooter="external"
          selectedTemplate={template}
          initialTargetAmount={formConfig.defaultTargetAmountInr}
          initialTargetDate={defaultTargetDate(template.default_tenure_months ?? 60)}
          initialExpectedReturn={template.suggested_return_pct ?? formConfig.defaultExpectedReturnPct}
          initialPriority={formConfig.defaultPriority}
          onSaveTemplate={onSave}
          savingTemplate={saving}
          saveTemplateError={error}
        />

        <BrandDialogFooter className="shrink-0 bg-background px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={GOAL_TEMPLATE_FORM_ID} disabled={saving}>
            <Check className="size-4" aria-hidden />
            {saving ? copy.goals.loading : copy.goals.saveTemplateAction}
          </Button>
        </BrandDialogFooter>
      </div>
    </BrandDialog>
  );
}
