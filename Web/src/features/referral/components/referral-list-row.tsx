"use client";

import { ReferralProgressBadge } from "@/features/referral/components/referral-progress-badge";
import { ReferralStatusRingBadge } from "@/features/referral/components/referral-progress-track";
import { ReferralUserAvatar } from "@/features/referral/components/referral-user-avatar";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { cn } from "@/lib/utils";

type ReferralListRowProps = {
  name: string;
  subtitle: string;
  imageUrl?: string | null;
  isCurrentUser?: boolean;
  progressStep: number;
  showProgressRing?: boolean;
  className?: string;
};

export function ReferralListRow({
  name,
  subtitle,
  imageUrl,
  isCurrentUser = false,
  progressStep,
  showProgressRing = false,
  className,
}: ReferralListRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border border-border/70 bg-muted/10 px-3 py-3 sm:px-4",
        REFERRAL_CARD_RADIUS_CLASS,
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ReferralUserAvatar
          name={name}
          imageUrl={imageUrl}
          isCurrentUser={isCurrentUser}
          className="size-11"
          fallbackClassName="bg-primary/10 text-primary"
        />

        <div className="min-w-0">
          <p className="truncate text-compact font-semibold text-foreground">{name}</p>
          <p className="mt-0.5 truncate text-caption text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {showProgressRing ? (
        <ReferralStatusRingBadge step={progressStep} />
      ) : (
        <ReferralProgressBadge step={progressStep} />
      )}
    </div>
  );
}
