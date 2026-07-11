"use client";

import { CheckCircle2, Users, Wallet, type LucideIcon } from "lucide-react";

import type { ReferralListItem } from "@/features/referral/api/referral-api";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralSummaryStats = {
  signup_count: number;
  qualified_count: number;
};

type ReferralSummaryStatCardsProps = {
  stats: ReferralSummaryStats;
  referrals: ReferralListItem[];
  totalEarningsInr?: number;
  earningsThisMonthInr?: number;
  className?: string;
};

type SummaryStatCardProps = {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: "blue" | "emerald" | "indigo";
};

const TONE_ICON_STYLES: Record<SummaryStatCardProps["tone"], string> = {
  blue: "text-muted-foreground/5",
  emerald: "text-muted-foreground/5",
  indigo: "text-muted-foreground/5",
};

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function countReferralsThisMonth(referrals: ReferralListItem[]) {
  const now = new Date();
  return referrals.filter((item) => {
    const signedUpAt = new Date(item.signed_up_at);
    return (
      signedUpAt.getMonth() === now.getMonth() &&
      signedUpAt.getFullYear() === now.getFullYear()
    );
  }).length;
}

function formatConversionRate(successful: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((successful / total) * 100)}%`;
}

function SummaryStatCard({ title, value, hint, icon: Icon, tone }: SummaryStatCardProps) {
  return (
    <article
      className={cn(
        "relative min-w-0 overflow-hidden border border-border bg-card p-3 sm:p-4",
        REFERRAL_CARD_RADIUS_CLASS
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-2 top-1/2 size-14 -translate-y-1/2 sm:size-16",
          TONE_ICON_STYLES[tone]
        )}
        strokeWidth={1.75}
      />

      <div className="relative z-10 min-w-0 pr-10">
        <p className="text-caption font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-h2 font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-caption font-medium text-success">{hint}</p>
      </div>
    </article>
  );
}

export function ReferralSummaryStatCards({
  stats,
  referrals,
  totalEarningsInr = 0,
  earningsThisMonthInr = 0,
  className,
}: ReferralSummaryStatCardsProps) {
  const referralsThisMonth = countReferralsThisMonth(referrals);
  const conversionRate = formatConversionRate(stats.qualified_count, stats.signup_count);

  const referralsThisMonthHint =
    referralsThisMonth > 0
      ? copy.referral.summaryReferralsThisMonth.replace("{count}", String(referralsThisMonth))
      : copy.referral.summaryNoReferralsThisMonth;

  const earningsThisMonthHint =
    earningsThisMonthInr > 0
      ? copy.referral.summaryEarningsThisMonth.replace("{amount}", formatInr(earningsThisMonthInr))
      : copy.referral.summaryNoEarningsThisMonth;

  return (
    <div className={cn("grid w-full min-w-0 grid-cols-3 gap-3", className)}>
      <SummaryStatCard
        title={copy.referral.summaryTotalReferrals}
        value={String(stats.signup_count)}
        hint={referralsThisMonthHint}
        icon={Users}
        tone="blue"
      />
      <SummaryStatCard
        title={copy.referral.summaryTotalEarnings}
        value={formatInr(totalEarningsInr)}
        hint={earningsThisMonthHint}
        icon={Wallet}
        tone="emerald"
      />
      <SummaryStatCard
        title={copy.referral.summarySuccessfulReferrals}
        value={String(stats.qualified_count)}
        hint={copy.referral.summaryConversionRate.replace("{rate}", conversionRate)}
        icon={CheckCircle2}
        tone="indigo"
      />
    </div>
  );
}
