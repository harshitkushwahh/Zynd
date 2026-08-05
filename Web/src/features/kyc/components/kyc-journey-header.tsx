"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { KYC_JOURNEY_STEPS, type KycJourneyStep } from "@/features/kyc/lib/kyc-journey";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycJourneyHeaderProps = {
  activeStepIndex?: number;
  steps?: KycJourneyStep[];
  title: string;
  onClose: () => void;
  showStepBadge?: boolean;
  showClose?: boolean;
  hideTitle?: boolean;
  className?: string;
};

export function KycJourneyHeader({
  activeStepIndex = 0,
  steps = KYC_JOURNEY_STEPS,
  title,
  onClose,
  showStepBadge = true,
  showClose = true,
  hideTitle = false,
  className,
}: KycJourneyHeaderProps) {
  const totalSteps = steps.length;

  const stepBadge = showStepBadge ? (
    <StatusBadge variant="neutral" showIcon={false} className="h-6 px-2.5 text-[11px]">
      {copy.kyc.stepOf(activeStepIndex + 1, totalSteps)}
    </StatusBadge>
  ) : null;

  if (!showClose && !showStepBadge) {
    return hideTitle ? null : <p className="sr-only">{title}</p>;
  }

  if (!showClose) {
    return (
      <header className={cn("flex items-center gap-3 px-6 py-3.5 pr-14 sm:px-8 sm:pr-16", className)}>
        {stepBadge}
        <p className="sr-only">{title}</p>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-3.5 sm:px-8",
        className,
      )}
    >
      <div className="justify-self-start">{stepBadge}</div>

      <p
        className={cn(
          "text-center text-compact font-semibold uppercase tracking-wide text-foreground",
          hideTitle && "sr-only",
        )}
      >
        {title}
      </p>

      <div className="justify-self-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </header>
  );
}
