"use client";

import { IndianRupee, ShieldCheck, UserCheck, type LucideIcon } from "lucide-react";

import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { REFERRAL_STATUS_LABELS } from "@/features/referral/lib/referral-display";
import { cn } from "@/lib/utils";

const REFERRAL_PROGRESS_BADGE_CONFIG: { variant: StatusBadgeVariant; icon: LucideIcon }[] = [
  { variant: "neutral", icon: UserCheck },
  { variant: "info", icon: ShieldCheck },
  { variant: "success", icon: IndianRupee },
];

type ReferralProgressBadgeProps = {
  step: number;
  totalSteps?: number;
  className?: string;
};

export function getReferralProgressBadgeConfig(step: number, totalSteps = 3) {
  const clampedStep = Math.max(1, Math.min(step, totalSteps));
  const config = REFERRAL_PROGRESS_BADGE_CONFIG[clampedStep - 1] ?? REFERRAL_PROGRESS_BADGE_CONFIG[0]!;

  return {
    step: clampedStep,
    variant: config.variant,
    icon: config.icon,
    label: REFERRAL_STATUS_LABELS[clampedStep - 1] ?? REFERRAL_STATUS_LABELS[0]!,
  };
}

export function ReferralProgressBadge({ step, totalSteps = 3, className }: ReferralProgressBadgeProps) {
  const { variant, icon, label } = getReferralProgressBadgeConfig(step, totalSteps);

  return (
    <StatusBadge variant={variant} icon={icon} className={cn("h-auto whitespace-nowrap py-1", className)}>
      {label}
    </StatusBadge>
  );
}
