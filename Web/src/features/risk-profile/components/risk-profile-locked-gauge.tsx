"use client";

import { Lock } from "lucide-react";

import { RiskProfileGauge } from "@/features/risk-profile/components/risk-profile-gauge";
import {
  RISK_PROFILE_PLACEHOLDER_SCORE,
  RISK_PROFILE_PLACEHOLDER_TIER,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type RiskProfileLockedGaugeProps = {
  className?: string;
};

export function RiskProfileLockedGauge({ className }: RiskProfileLockedGaugeProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col items-center justify-center px-2", className)}>
      <div className="relative mx-auto w-full max-w-[20rem]">
        <div className="pointer-events-none select-none blur-[5px]">
          <RiskProfileGauge
            score={RISK_PROFILE_PLACEHOLDER_SCORE}
            tier={RISK_PROFILE_PLACEHOLDER_TIER}
            compact
            className="max-w-[11.5rem]"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 risk-profile-gauge-overlay" aria-hidden />
        <div className="absolute inset-0 flex items-center justify-center px-1">
          <div className="flex w-full min-w-[17rem] max-w-[19rem] items-center gap-3 px-4 py-3 shadow-zynd-mid backdrop-blur-sm sip-lock-panel">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-compact font-semibold text-foreground">{copy.riskProfile.lockedGaugeTitle}</p>
              <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
                {copy.riskProfile.lockedGaugeDescription}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
