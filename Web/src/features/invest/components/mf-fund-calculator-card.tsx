"use client";

import { Calculator } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvestFundDetail, InvestReturnCalculator } from "@/features/invest/api/invest-api";
import { MfFundCalculatorPanel } from "@/features/invest/components/mf-fund-calculator-panel";
import { MF_FUND_DETAIL_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFundCalculatorCardProps = {
  fund: InvestFundDetail;
  initialCalculator?: InvestReturnCalculator | null;
};

export function MfFundCalculatorCard({ fund, initialCalculator }: MfFundCalculatorCardProps) {
  return (
    <Card className={cn("overflow-hidden border border-border", MF_FUND_DETAIL_RADIUS_CLASS)}>
      <CardHeader className="border-b border-border/60 bg-muted/10">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Calculator className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
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
