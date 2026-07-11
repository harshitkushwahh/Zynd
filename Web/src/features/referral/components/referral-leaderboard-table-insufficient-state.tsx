"use client";

import { Lock } from "lucide-react";

import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralLeaderboardTableInsufficientStateProps = {
  className?: string;
};

export function ReferralLeaderboardTableInsufficientState({
  className,
}: ReferralLeaderboardTableInsufficientStateProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border border-dashed border-border bg-muted/10 px-4 py-8 text-left sm:px-5",
        REFERRAL_CARD_RADIUS_CLASS,
        className
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <Lock className="size-4 text-muted-foreground" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
        <p className="text-compact font-semibold text-foreground">
          {copy.referral.leaderboardTableInsufficientTitle}
        </p>
        <p className="text-caption leading-relaxed text-muted-foreground">
          {copy.referral.leaderboardTableInsufficientSubtitle}
        </p>
      </div>
    </div>
  );
}
