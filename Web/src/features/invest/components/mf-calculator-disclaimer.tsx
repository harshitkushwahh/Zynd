"use client";

import { FieldMessage } from "@/components/ui/ui-message";
import { copy } from "@/shared/config/copy";

type MfCalculatorDisclaimerProps = {
  disclaimer: string;
  dataQuality?: string | null;
};

export function MfCalculatorDisclaimer({ disclaimer, dataQuality }: MfCalculatorDisclaimerProps) {
  return (
    <div className="space-y-2">
      <FieldMessage variant="info" message={disclaimer} />
      {dataQuality === "shallow_nav_history" || dataQuality === "insufficient_history" ? (
        <FieldMessage variant="warning" message={copy.mutualFunds.calculatorDataShallow} />
      ) : null}
    </div>
  );
}
