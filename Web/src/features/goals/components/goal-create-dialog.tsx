"use client";

import { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateGoalInput, GoalTemplate } from "@/features/goals/api/goals-api";
import { defaultTargetDate } from "@/features/goals/lib/goal-calculator";
import {
  hasGoalFormErrors,
  normalizeGoalPriority,
  validateGoalForm,
  type GoalFormFieldErrors,
} from "@/features/goals/lib/goal-validation";
import { copy } from "@/shared/config/copy";

type GoalCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: GoalTemplate[];
  onSubmit: (input: CreateGoalInput) => Promise<void>;
  submitting?: boolean;
  error?: string;
};

export function GoalCreateDialog({
  open,
  onOpenChange,
  templates,
  onSubmit,
  submitting = false,
  error = "",
}: GoalCreateDialogProps) {
  const [templateId, setTemplateId] = useState<string>("custom");
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [priority, setPriority] = useState(String(normalizeGoalPriority(3)));
  const [targetAmount, setTargetAmount] = useState("500000");
  const [targetDate, setTargetDate] = useState(defaultTargetDate());
  const [existingSavings, setExistingSavings] = useState("0");
  const [expectedReturn, setExpectedReturn] = useState("12");
  const [fieldErrors, setFieldErrors] = useState<GoalFormFieldErrors>({});

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    setTitle(selectedTemplate.name);
    setTargetDate(defaultTargetDate(selectedTemplate.default_tenure_months));
    if (selectedTemplate.suggested_return_pct != null) {
      setExpectedReturn(String(selectedTemplate.suggested_return_pct));
    }
  }, [selectedTemplate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateGoalForm({
      title,
      target_amount_inr: Number(targetAmount),
      target_date: targetDate,
    });
    setFieldErrors(validation);
    if (hasGoalFormErrors(validation)) return;

    await onSubmit({
      title: title.trim(),
      target_amount_inr: Number(targetAmount),
      target_date: targetDate,
      template_id: templateId === "custom" ? undefined : templateId,
      tag: tag.trim() || undefined,
      priority: normalizeGoalPriority(Number(priority)),
      existing_savings_inr: Number(existingSavings) || 0,
      expected_return_pct: Number(expectedReturn) || undefined,
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setTemplateId("custom");
      setTitle("");
      setTag("");
      setPriority(String(normalizeGoalPriority(3)));
      setTargetAmount("500000");
      setTargetDate(defaultTargetDate());
      setExistingSavings("0");
      setExpectedReturn("12");
      setFieldErrors({});
    }
    onOpenChange(nextOpen);
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.goals.createTitle}
      description={copy.goals.createDescription}
      icon={Target}
      maxWidth="md"
    >
      <form id="goal-create-form" className="space-y-4 px-6 py-5" onSubmit={(event) => void handleSubmit(event)}>
        <div className="space-y-2">
          <Label>{copy.goals.templateLabel}</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder={copy.goals.templateLabel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">{copy.goals.customTemplate}</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal-title">{copy.goals.titleLabel}</Label>
          <Input
            id="goal-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={copy.goals.titlePlaceholder}
            maxLength={80}
            required
            aria-invalid={Boolean(fieldErrors.title)}
          />
          {fieldErrors.title ? <p className="text-compact text-destructive">{fieldErrors.title}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-target-amount">{copy.goals.targetAmountLabel}</Label>
            <Input
              id="goal-target-amount"
              type="number"
              min={1}
              value={targetAmount}
              onChange={(event) => setTargetAmount(event.target.value)}
              aria-invalid={Boolean(fieldErrors.target_amount_inr)}
            />
            {fieldErrors.target_amount_inr ? (
              <p className="text-compact text-destructive">{fieldErrors.target_amount_inr}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-target-date">{copy.goals.targetDateLabel}</Label>
            <Input
              id="goal-target-date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              aria-invalid={Boolean(fieldErrors.target_date)}
            />
            {fieldErrors.target_date ? (
              <p className="text-compact text-destructive">{fieldErrors.target_date}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-tag">{copy.goals.tagLabel}</Label>
            <Input
              id="goal-tag"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder={copy.goals.tagPlaceholder}
              maxLength={32}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-priority">{copy.goals.priorityLabel}</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="goal-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {([1, 2, 3, 4, 5] as const).map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {copy.goals.priorityOptions[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-existing-savings">{copy.goals.existingSavingsLabel}</Label>
            <Input
              id="goal-existing-savings"
              type="number"
              min={0}
              value={existingSavings}
              onChange={(event) => setExistingSavings(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-expected-return">{copy.goals.expectedReturnLabel}</Label>
            <Input
              id="goal-expected-return"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={expectedReturn}
              onChange={(event) => setExpectedReturn(event.target.value)}
            />
          </div>
        </div>

        {error ? <p className="text-compact text-destructive">{error}</p> : null}
      </form>

      <BrandDialogFooter>
        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" form="goal-create-form" disabled={submitting}>
          {submitting ? copy.goals.loading : copy.goals.saveAction}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
