"use client";

import type { LucideIcon } from "lucide-react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ProfileKycStatusPopoverCard } from "@/features/dashboard/overview/components/profile-kyc-status-popover-card";
import { ProfileProgressRing } from "@/features/dashboard/overview/components/overview-profile-status-badge";
import type { OverviewKycProfileProgress } from "@/features/dashboard/overview/lib/overview-profile-kyc-state";
import { cn } from "@/lib/utils";

type ProfileKycStatusBadgeProps = {
  ariaLabel: string;
  progress: OverviewKycProfileProgress;
  stepIcon: LucideIcon;
  blocked?: boolean;
  complete?: boolean;
  submitted?: boolean;
  onActivate?: () => void;
};

export function ProfileKycStatusBadge({
  ariaLabel,
  progress,
  stepIcon,
  blocked = false,
  complete = false,
  submitted = false,
  onActivate,
}: ProfileKycStatusBadgeProps) {
  const canActivate = Boolean(onActivate) && !blocked && !complete && !submitted;

  const handleActivate = () => {
    if (canActivate) onActivate?.();
  };

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        closeDelay={280}
        render={
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              canActivate && "cursor-pointer transition-transform hover:scale-105 active:scale-95",
            )}
            aria-label={ariaLabel}
            onClick={handleActivate}
          />
        }
      >
        <ProfileProgressRing
          progressFraction={progress.progressFraction}
          tone={progress.tone}
          icon={stepIcon}
          complete={complete}
          submitted={submitted}
        />
      </HoverCardTrigger>

      <HoverCardContent
        side="top"
        align="center"
        sideOffset={10}
        className="w-52 rounded-[1.25rem] p-0"
      >
        <ProfileKycStatusPopoverCard
          progress={progress}
          stepIcon={stepIcon}
          blocked={blocked}
          activatable={canActivate}
          onActivate={handleActivate}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
