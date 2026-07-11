"use client";

import { KycJourneyHeader } from "@/features/kyc/components/kyc-journey-header";
import { KycJourneyProgress } from "@/features/kyc/components/kyc-journey-progress";
import type { KycJourneyStep } from "@/features/kyc/lib/kyc-journey";
import { cn } from "@/lib/utils";

type KycDialogChromeProps = {
  activeStepIndex?: number;
  steps?: KycJourneyStep[];
  title: string;
  onClose: () => void;
  onBack?: () => void;
  showStepBadge?: boolean;
  showProgress?: boolean;
  hideBottomBorder?: boolean;
  className?: string;
};

export function KycDialogChrome({
  activeStepIndex = 0,
  steps,
  title,
  onClose,
  onBack,
  showStepBadge = true,
  showProgress = false,
  hideBottomBorder = false,
  className,
}: KycDialogChromeProps) {
  return (
    <div
      className={cn(
        "kyc-dialog-chrome flex shrink-0 flex-col gap-2",
        hideBottomBorder && "kyc-dialog-chrome--flat",
        className,
      )}
    >
      <KycJourneyHeader
        activeStepIndex={activeStepIndex}
        steps={steps}
        title={title}
        onClose={onClose}
        onBack={onBack}
        showStepBadge={showStepBadge}
        className="border-b-0 pb-0"
      />
      {showProgress ? (
        <div className="px-6 pb-3.5 sm:px-7">
          <KycJourneyProgress activeStepIndex={activeStepIndex} steps={steps} />
        </div>
      ) : null}
    </div>
  );
}
