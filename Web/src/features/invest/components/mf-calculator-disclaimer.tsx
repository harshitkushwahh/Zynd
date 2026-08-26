"use client";

import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { copy } from "@/shared/config/copy";

type MfCalculatorDisclaimerProps = {
  disclaimer: string;
  dataQuality?: string | null;
  note?: string | null;
};

export function MfCalculatorDisclaimer({
  disclaimer,
  dataQuality,
  note,
}: MfCalculatorDisclaimerProps) {
  const message = [note, disclaimer].filter(Boolean).join(" · ");
  if (!message) return null;

  return (
    <div className="space-y-2">
      <UiMessage variant="info" className="mt-0" message={message} />
      {dataQuality === "shallow_nav_history" || dataQuality === "insufficient_history" ? (
        <FieldMessage variant="warning" message={copy.mutualFunds.calculatorDataShallow} />
      ) : null}
    </div>
  );
}
