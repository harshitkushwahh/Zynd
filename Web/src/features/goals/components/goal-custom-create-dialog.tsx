"use client";

import { Check, PenLine } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import {
  GoalCalculatorPanel,
  type GoalCustomSaveInput,
} from "@/features/goals/components/goal-calculator-panel";
import { GOAL_DIALOG_SHELL_CLASS } from "@/features/goals/components/goal-dialog-layout";
import { defaultTargetDate } from "@/features/goals/lib/goal-calculator";
import { getGoalFormConfig } from "@/features/goals/lib/goal-form-config";
import { goalTemplateIconThemeFor } from "@/features/goals/lib/goal-template-meta";
import { copy } from "@/shared/config/copy";

const GOAL_CUSTOM_FORM_ID = "goal-custom-journey-form";

type GoalCustomCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: GoalCustomSaveInput) => Promise<void>;
  saving?: boolean;
  error?: string;
};

export function GoalCustomCreateDialog({
  open,
  onOpenChange,
  onSave,
  saving = false,
  error = "",
}: GoalCustomCreateDialogProps) {
  const formConfig = getGoalFormConfig(undefined);
  const theme = goalTemplateIconThemeFor("custom");

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.goals.createTitle}
      description={copy.goals.createDescription}
      icon={PenLine}
      maxWidth="xl"
      headerDensity="compact"
      headerVariant="light"
      closeTone="default"
      iconClassName={theme.headerIconClass}
      className={GOAL_DIALOG_SHELL_CLASS}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <GoalCalculatorPanel
          key={open ? "custom-open" : "custom-closed"}
          layout="custom-dialog"
          formId={GOAL_CUSTOM_FORM_ID}
          saveFooter="external"
          initialTargetAmount={formConfig.defaultTargetAmountInr}
          initialTargetDate={defaultTargetDate()}
          initialExpectedReturn={formConfig.defaultExpectedReturnPct}
          initialPriority={formConfig.defaultPriority}
          onSaveCustom={onSave}
          savingCustom={saving}
          saveCustomError={error}
        />

        <BrandDialogFooter className="shrink-0 bg-background px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={GOAL_CUSTOM_FORM_ID} disabled={saving}>
            <Check className="size-4" aria-hidden />
            {saving ? copy.goals.loading : copy.goals.saveAction}
          </Button>
        </BrandDialogFooter>
      </div>
    </BrandDialog>
  );
}
