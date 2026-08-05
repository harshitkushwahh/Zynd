"use client";

import { KycJourneyCircleSteps } from "@/features/kyc/components/kyc-journey-circle-steps";
import { KycJourneyHeader } from "@/features/kyc/components/kyc-journey-header";
import type { KycJourneyStep } from "@/features/kyc/lib/kyc-journey";
import { cn } from "@/lib/utils";

type KycDialogChromeProps = {
  activeStepIndex?: number;
  maxReachableStepIndex?: number;
  steps?: KycJourneyStep[];
  title: string;
  onClose: () => void;
  onStepSelect?: (index: number) => void;
  showStepBadge?: boolean;
  showCircleSteps?: boolean;
  hideBottomBorder?: boolean;
  hideTitle?: boolean;
  showClose?: boolean;
  className?: string;
};

export function KycDialogChrome({
  activeStepIndex = 0,
  maxReachableStepIndex = 0,
  steps,
  title,
  onClose,
  onStepSelect,
  showStepBadge = true,
  showCircleSteps = false,
  hideBottomBorder = false,
  hideTitle = false,
  showClose = true,
  className,
}: KycDialogChromeProps) {
  const showHeader = showClose || (showStepBadge && !showCircleSteps);

  return (
    <div
      className={cn(
        "kyc-dialog-chrome flex shrink-0 flex-col gap-2",
        hideBottomBorder && "kyc-dialog-chrome--flat",
        className,
      )}
    >
      {showHeader ? (
        <KycJourneyHeader
          activeStepIndex={activeStepIndex}
          steps={steps}
          title={title}
          onClose={onClose}
          showStepBadge={showStepBadge}
          hideTitle={hideTitle}
          showClose={showClose}
          className="border-b-0 pb-0"
        />
      ) : hideTitle ? null : (
        <p className="sr-only">{title}</p>
      )}
      {showCircleSteps && steps && onStepSelect ? (
        <div className="pt-10 pr-12 sm:pt-11 sm:pr-14">
          <KycJourneyCircleSteps
            activeStepIndex={activeStepIndex}
            maxReachableStepIndex={maxReachableStepIndex}
            steps={steps}
            onStepSelect={onStepSelect}
          />
        </div>
      ) : null}
    </div>
  );
}
