"use client";

import { UserPlus } from "lucide-react";

import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralYourReferralsEmptyStateProps = {
  variant?: "default" | "compact";
  className?: string;
};

export function ReferralYourReferralsEmptyState({
  variant = "default",
  className,
}: ReferralYourReferralsEmptyStateProps) {
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border border-dashed border-border bg-muted/10 px-4 text-center",
        isCompact ? "min-h-[8.5rem] py-6" : "min-h-[10rem] py-8 sm:min-h-[11rem]",
        REFERRAL_CARD_RADIUS_CLASS,
        className
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-primary/10",
          isCompact ? "size-10" : "size-12"
        )}
      >
        <UserPlus
          className={cn("text-primary", isCompact ? "size-5" : "size-6")}
          strokeWidth={2}
        />
      </div>

      <div className={cn("mt-3 space-y-1", isCompact ? "max-w-none" : "max-w-xs")}>
        <p className={cn("font-semibold text-foreground", isCompact ? "text-caption" : "text-compact")}>
          {copy.referral.referralsEmptyTitle}
        </p>
        <p className="text-caption leading-relaxed text-muted-foreground">{copy.referral.referralsEmpty}</p>
      </div>
    </div>
  );
}
