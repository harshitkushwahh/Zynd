"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  calculateGoal,
  type GoalCalculatorResult,
  type GoalTemplate,
} from "@/features/goals/api/goals-api";
import {
  clampGoalAmount,
  defaultTargetDate,
  goalAmountStep,
  GOAL_DEFAULT_RETURN_PCT,
} from "@/features/goals/lib/goal-calculator";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";

type GoalCalculatorPanelProps = {
  templates: GoalTemplate[];
  selectedTemplateId?: string | null;
  initialTargetAmount?: number;
  initialTargetDate?: string;
  initialExistingSavings?: number;
  initialExpectedReturn?: number;
  onCalculated?: (result: GoalCalculatorResult) => void;
};

export function GoalCalculatorPanel({
  templates,
  selectedTemplateId,
  initialTargetAmount = 500_000,
  initialTargetDate,
  initialExistingSavings = 0,
  initialExpectedReturn = GOAL_DEFAULT_RETURN_PCT,
  onCalculated,
}: GoalCalculatorPanelProps) {
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const [targetAmount, setTargetAmount] = useState(initialTargetAmount);
  const [targetDate, setTargetDate] = useState(
    initialTargetDate ?? defaultTargetDate(selectedTemplate?.default_tenure_months ?? 60),
  );
  const [existingSavings, setExistingSavings] = useState(initialExistingSavings);
  const [expectedReturn, setExpectedReturn] = useState(
    selectedTemplate?.suggested_return_pct ?? initialExpectedReturn,
  );
  const [result, setResult] = useState<GoalCalculatorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedTemplate) return;
    setTargetDate(defaultTargetDate(selectedTemplate.default_tenure_months));
    if (selectedTemplate.suggested_return_pct != null) {
      setExpectedReturn(selectedTemplate.suggested_return_pct);
    }
  }, [selectedTemplate]);

  async function handleCalculate() {
    setLoading(true);
    setError("");
    try {
      const payload = await calculateGoal({
        target_amount_inr: targetAmount,
        target_date: targetDate,
        existing_savings_inr: existingSavings,
        expected_return_pct: expectedReturn,
      });
      setResult(payload);
      onCalculated?.(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : "";
      setError(message || "Unable to calculate goal plan.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const amountStep = goalAmountStep(targetAmount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="size-5" aria-hidden />
          {copy.goals.calculatorTitle}
        </CardTitle>
        <CardDescription>{copy.goals.calculatorDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="goal-target-amount">{copy.goals.targetAmountLabel}</Label>
            <span className="text-compact font-medium">{formatInr(targetAmount)}</span>
          </div>
          <Slider
            id="goal-target-amount"
            min={10_000}
            max={50_00_000}
            step={amountStep}
            value={[targetAmount]}
            onValueChange={(value) => setTargetAmount(clampGoalAmount(value[0] ?? targetAmount))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-target-date">{copy.goals.targetDateLabel}</Label>
            <Input
              id="goal-target-date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-existing-savings">{copy.goals.existingSavingsLabel}</Label>
            <Input
              id="goal-existing-savings"
              type="number"
              min={0}
              value={existingSavings}
              onChange={(event) => setExistingSavings(Number(event.target.value) || 0)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="goal-expected-return">{copy.goals.expectedReturnLabel}</Label>
            <span className="text-compact font-medium">{expectedReturn.toFixed(1)}%</span>
          </div>
          <Slider
            id="goal-expected-return"
            min={4}
            max={18}
            step={0.5}
            value={[expectedReturn]}
            onValueChange={(value) => setExpectedReturn(value[0] ?? expectedReturn)}
          />
        </div>

        {error ? <p className="text-compact text-destructive">{error}</p> : null}

        <Button type="button" onClick={() => void handleCalculate()} disabled={loading}>
          {loading ? copy.goals.loading : copy.goals.calculateAction}
        </Button>

        {result ? (
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
            <div>
              <p className="text-compact text-muted-foreground">{copy.goals.requiredSipLabel}</p>
              <p className="text-lg font-semibold">{formatInr(result.required_monthly_sip_inr)}</p>
            </div>
            <div>
              <p className="text-compact text-muted-foreground">{copy.goals.requiredLumpsumLabel}</p>
              <p className="text-lg font-semibold">{formatInr(result.required_lumpsum_inr)}</p>
            </div>
            <div>
              <p className="text-compact text-muted-foreground">{copy.goals.projectedValueLabel}</p>
              <p className="text-lg font-semibold">{formatInr(result.projected_value_inr)}</p>
            </div>
            <div>
              <p className="text-compact text-muted-foreground">{copy.goals.durationLabel}</p>
              <p className="text-lg font-semibold">{copy.goals.monthsLabel(result.duration_months)}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
