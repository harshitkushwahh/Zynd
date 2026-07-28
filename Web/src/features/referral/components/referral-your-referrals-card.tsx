"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ReferralListRow } from "@/features/referral/components/referral-list-row";
import { ReferralYourReferralsEmptyState } from "@/features/referral/components/referral-your-referrals-empty-state";
import type { ReferralListItem } from "@/features/referral/api/referral-api";
import {
  mapReferralDisplayItems,
  REFERRAL_PREVIEW_LIMIT,
  summarizeReferralList,
} from "@/features/referral/lib/referral-display";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralYourReferralsCardProps = {
  referrals: ReferralListItem[];
  className?: string;
};

export function ReferralYourReferralsCard({ referrals, className }: ReferralYourReferralsCardProps) {
  const displayItems = mapReferralDisplayItems(referrals);
  const previewItems = displayItems.slice(0, REFERRAL_PREVIEW_LIMIT);
  const totalCount = summarizeReferralList(referrals).totalCount;
  const isEmpty = previewItems.length === 0;

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col border border-border bg-card p-4 sm:p-5",
        REFERRAL_CARD_RADIUS_CLASS,
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="text-compact font-semibold text-foreground">{copy.referral.referralsTitle}</p>
        <Button
          variant="muted"
          size="sm"
          className="shrink-0"
          nativeButton={false}
          render={<Link href="/dashboard/referral/referrals" />}
        >
          {copy.referral.referralsViewAll}
        </Button>
      </div>

      <div className={cn("mt-4 flex min-h-0 flex-1 flex-col", isEmpty && "flex-1")}>
        {isEmpty ? (
          <ReferralYourReferralsEmptyState className="flex-1" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2.5">
            {previewItems.map((item) => (
              <ReferralListRow
                key={item.id}
                name={item.name}
                subtitle={item.email}
                imageUrl={item.profileImageUrl}
                progressStep={item.progressStep}
                showProgressRing
              />
            ))}
          </div>
        )}
      </div>

      <p className="mt-auto shrink-0 pt-3 text-center text-caption text-muted-foreground/55">
        {copy.referral.referralsTotalCount.replace("{count}", String(totalCount))}
      </p>
    </section>
  );
}
