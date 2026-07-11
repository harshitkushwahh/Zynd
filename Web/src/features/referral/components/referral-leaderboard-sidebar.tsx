"use client";

import Link from "next/link";
import { ArrowRight, Link2, TrendingUp } from "lucide-react";

import type { ReferralLeaderboardCurrentUser } from "@/features/referral/api/referral-api";
import type { ReferralListItem } from "@/features/referral/api/referral-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { ReferralListRow } from "@/features/referral/components/referral-list-row";
import { ReferralYourReferralsEmptyState } from "@/features/referral/components/referral-your-referrals-empty-state";
import {
  formatReferralInr,
  mapReferralToDisplayItem,
} from "@/features/referral/lib/referral-display";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralLeaderboardSidebarProps = {
  currentUser: ReferralLeaderboardCurrentUser;
  recentReferrals: ReferralListItem[];
};

function StatRow({
  label,
  value,
  valueClassName,
  withDivider = true,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  withDivider?: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 py-3.5">
        <span className="text-compact text-muted-foreground">{label}</span>
        <span className={cn("text-compact font-semibold tabular-nums text-foreground", valueClassName)}>
          {value}
        </span>
      </div>
      {withDivider ? <div className="h-px bg-border/70" aria-hidden /> : null}
    </>
  );
}

export function ReferralLeaderboardSidebar({
  currentUser,
  recentReferrals,
}: ReferralLeaderboardSidebarProps) {
  const topPercentLabel =
    currentUser.topPercent != null
      ? copy.referral.leaderboardDoingGreatTopPercent.replace(
          "{percent}",
          String(currentUser.topPercent)
        )
      : null;
  const recentItems = recentReferrals.slice(0, 3).map(mapReferralToDisplayItem);

  return (
    <aside className="flex flex-col gap-4">
      <section
        className={cn(
          "overflow-hidden border border-border bg-card p-4 sm:p-5",
          REFERRAL_CARD_RADIUS_CLASS
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-success/25 to-success/10 ring-1 ring-success/20">
            <TrendingUp className="size-5 text-success" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-compact font-semibold text-foreground">{copy.referral.leaderboardDoingGreatTitle}</p>
            <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
              {topPercentLabel ? (
                <>
                  {copy.referral.leaderboardDoingGreatSubtitleLead}{" "}
                  <span className="font-semibold text-success">{topPercentLabel}</span>{" "}
                  {copy.referral.leaderboardDoingGreatSubtitleSuffix}
                </>
              ) : (
                copy.referral.leaderboardEmptySubtitle
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-4">
          <StatRow
            label={copy.referral.leaderboardYourRank}
            value={currentUser.rank != null ? `#${currentUser.rank}` : copy.referral.leaderboardNoRank}
            valueClassName="text-success"
          />
          <StatRow
            label={copy.referral.leaderboardTotalReferralsLabel}
            value={String(currentUser.referralCount)}
          />
          <StatRow
            label={copy.referral.leaderboardTotalEarningsLabel}
            value={formatReferralInr(currentUser.earningsInr)}
            valueClassName="text-success"
            withDivider={false}
          />
        </div>

        <Link
          href="/dashboard/referral"
          className={cn(buttonVariants({ variant: "default", size: "default" }), "mt-5 w-full gap-2")}
        >
          <Link2 className="size-4" strokeWidth={2.25} />
          {copy.referral.leaderboardShareYourLink}
        </Link>
      </section>

      <section className={cn("border border-border bg-card p-4 sm:p-5", REFERRAL_CARD_RADIUS_CLASS)}>
        <p className="text-compact font-semibold text-foreground">{copy.referral.leaderboardRecentReferrals}</p>

        {recentItems.length === 0 ? (
          <ReferralYourReferralsEmptyState variant="compact" className="mt-4" />
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            {recentItems.map((item) => (
              <ReferralListRow
                key={item.id}
                name={item.name}
                subtitle={item.email}
                imageUrl={item.profileImageUrl}
                progressStep={item.progressStep}
              />
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          nativeButton={false}
          render={<Link href="/dashboard/referral/referrals" />}
        >
          {copy.referral.referralsViewAll}
          <ArrowRight className="size-3.5" strokeWidth={2.25} />
        </Button>
      </section>
    </aside>
  );
}
