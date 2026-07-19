"use client";

import { Calculator } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvestFundDetail, InvestReturnCalculator } from "@/features/invest/api/invest-api";
import { MfFundCalculatorPanel } from "@/features/invest/components/mf-fund-calculator-panel";
import { copy } from "@/shared/config/copy";

type MfFundCalculatorCardProps = {
  fund: InvestFundDetail;
  initialCalculator?: InvestReturnCalculator | null;
};

export function MfFundCalculatorCard({ fund, initialCalculator }: MfFundCalculatorCardProps) {
  return (
    <Card className="overflow-hidden rounded-[var(--radius-medium)] border border-border">
      <CardHeader className="border-b border-border/60 bg-muted/10">
        <div className="flex items-start gap-3">
          <div className="sip-icon-badge mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
            <Calculator className="size-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <CardTitle>{copy.mutualFunds.fundCalculatorTitle}</CardTitle>
            <CardDescription>{copy.mutualFunds.fundCalculatorDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-4">
        <MfFundCalculatorPanel fund={fund} initialCalculator={initialCalculator} />
      </CardContent>
    </Card>
  );
}
