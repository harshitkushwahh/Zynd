"use client";

import { ArrowLeft, XIcon } from "lucide-react";

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
  onBack?: () => void;
  showStepBadge?: boolean;
  className?: string;
};

export function KycJourneyHeader({
  activeStepIndex = 0,
  steps = KYC_JOURNEY_STEPS,
  title,
  onClose,
  onBack,
  showStepBadge = true,
  className,
}: KycJourneyHeaderProps) {
  const totalSteps = steps.length;
  const canGoBack = activeStepIndex > 0 && Boolean(onBack);

  return (
    <header
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-3.5 sm:px-7",
        className
      )}
    >
      <div className="justify-self-start">
        {showStepBadge ? (
          canGoBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={copy.kyc.back}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-[var(--radius-control)] border border-border bg-muted/40 px-2.5 text-[11px] font-medium leading-none text-muted-foreground transition-colors",
                "hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              <ArrowLeft className="size-3 shrink-0" strokeWidth={2.25} />
              <span>{copy.kyc.stepOf(activeStepIndex + 1, totalSteps)}</span>
            </button>
          ) : (
            <StatusBadge variant="neutral" showIcon={false} className="h-6 px-2.5 text-[11px]">
              {copy.kyc.stepOf(activeStepIndex + 1, totalSteps)}
            </StatusBadge>
          )
        ) : null}
      </div>

      <p className="text-center text-compact font-semibold uppercase tracking-wide text-foreground">
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
