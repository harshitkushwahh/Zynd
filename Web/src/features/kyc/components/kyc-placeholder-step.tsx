"use client";

import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";

type KycPlaceholderStepProps = {
  description: string;
  onContinue: () => void;
  continueLabel?: string;
};

export function KycPlaceholderStep({
  description,
  onContinue,
  continueLabel = copy.kyc.continue,
}: KycPlaceholderStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-center text-body text-muted-foreground">{description}</p>
      <Button type="button" size="lg" className="w-full" onClick={onContinue}>
        {continueLabel}
      </Button>
    </div>
  );
}
