import type { ReferralListItem } from "@/features/referral/api/referral-api";
import { initialsFromName } from "@/features/referral/lib/referral-initials";

import { copy } from "@/shared/config/copy";

export const REFERRAL_STATUS_LABELS = [
  copy.referral.referralProgressOnboarded,
  copy.referral.referralProgressKyc,
  copy.referral.referralProgressInvested,
] as const;

export type ReferralDisplayItem = {
  id: string;
  name: string;
  email: string;
  channel: "email" | "google" | "apple";
  progressStep: number;
  earningsInr: number;
  signedUpAt: string;
  profileImageUrl?: string | null;
};

export type ReferralsPeriod = "this_month" | "last_3_months" | "all_time";

export const REFERRAL_REWARD_RATE = 0.02;

/** Rows shown on the full Your referrals page. */
export const REFERRAL_LIST_PAGE_SIZE = 8;

/** Preview rows shown in the Your referrals card. */
export const REFERRAL_PREVIEW_LIMIT = 4;

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "user";
  return local
    .replace(/\*/g, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function periodStart(period: ReferralsPeriod, now = new Date()) {
  if (period === "all_time") {
    return null;
  }
  if (period === "this_month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const start = new Date(now);
  start.setDate(start.getDate() - 90);
  return start;
}

export function referralProgressStep(item: ReferralListItem) {
  if (
    item.current_stage === "first_investment" ||
    item.current_stage === "qualified" ||
    item.current_stage === "engaged"
  ) {
    return 3;
  }
  if (item.current_stage === "kyc_verified") {
    return 2;
  }
  return 1;
}

export function referralEarningsInr(item: ReferralListItem) {
  if (referralProgressStep(item) < 3 || item.first_investment_amount_inr == null) {
    return 0;
  }
  return Math.round(item.first_investment_amount_inr * REFERRAL_REWARD_RATE);
}

export function mapReferralToDisplayItem(item: ReferralListItem): ReferralDisplayItem {
  const name = item.name?.trim() || nameFromEmail(item.masked_email);

  return {
    id: item.id,
    name,
    email: item.masked_email,
    channel: item.signup_channel,
    progressStep: referralProgressStep(item),
    earningsInr: referralEarningsInr(item),
    signedUpAt: item.signed_up_at,
    profileImageUrl: item.profile_image_url ?? null,
  };
}

export function mapReferralDisplayItems(referrals: ReferralListItem[]) {
  return referrals.map(mapReferralToDisplayItem);
}

export function filterReferralsByPeriod(referrals: ReferralListItem[], period: ReferralsPeriod) {
  const start = periodStart(period);
  if (!start) {
    return referrals;
  }

  return referrals.filter((item) => new Date(item.signed_up_at) >= start);
}

export function summarizeReferralDisplayItems(items: ReferralDisplayItem[]) {
  const successfulCount = items.filter((item) => item.progressStep >= 3).length;
  const totalEarningsInr = items.reduce((sum, item) => sum + item.earningsInr, 0);

  return {
    totalCount: items.length,
    successfulCount,
    totalEarningsInr,
  };
}

export function summarizeReferralList(referrals: ReferralListItem[]) {
  return summarizeReferralDisplayItems(mapReferralDisplayItems(referrals));
}

export function countReferralsThisMonth(referrals: ReferralListItem[]) {
  return filterReferralsByPeriod(referrals, "this_month").length;
}

export function sumEarningsThisMonth(referrals: ReferralListItem[]) {
  const start = periodStart("this_month");
  if (!start) {
    return 0;
  }

  return referrals.reduce((sum, item) => {
    const investedAt = item.first_investment_at ?? item.qualified_at;
    if (!investedAt || referralEarningsInr(item) === 0) {
      return sum;
    }
    return new Date(investedAt) >= start ? sum + referralEarningsInr(item) : sum;
  }, 0);
}

export function formatReferralInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRelativeJoinedLabel(signedUpAt: string, now = new Date()) {
  const signedUp = new Date(signedUpAt);
  const diffMs = now.getTime() - signedUp.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) {
    return copy.referral.referralsJoinedToday;
  }
  if (diffDays === 1) {
    return copy.referral.referralsJoinedYesterday;
  }
  if (diffDays < 7) {
    return copy.referral.referralsJoinedDaysAgo.replace("{count}", String(diffDays));
  }
  if (diffDays < 14) {
    return copy.referral.referralsJoinedWeekAgo;
  }
  if (diffDays < 30) {
    return copy.referral.referralsJoinedWeeksAgo.replace("{count}", String(Math.floor(diffDays / 7)));
  }
  return copy.referral.referralsJoinedMonthAgo;
}

export type EarningsPoint = {
  label: string;
  value: number;
};

export const PLACEHOLDER_EARNINGS_SERIES: Record<ReferralsPeriod, EarningsPoint[]> = {
  this_month: [
    { label: "Week 1", value: 820 },
    { label: "Week 2", value: 1240 },
    { label: "Week 3", value: 1680 },
    { label: "Week 4", value: 2100 },
  ],
  last_3_months: [
    { label: "Jan", value: 1200 },
    { label: "Feb", value: 1850 },
    { label: "Mar", value: 2400 },
    { label: "Apr", value: 3100 },
  ],
  all_time: [
    { label: "2024 Q3", value: 900 },
    { label: "2024 Q4", value: 1600 },
    { label: "2025 Q1", value: 2400 },
    { label: "2025 Q2", value: 3100 },
  ],
};

export function hasReferralEarningsData(referrals: ReferralListItem[]) {
  return referrals.some((item) => referralEarningsInr(item) > 0);
}

function earningsEventDate(item: ReferralListItem) {
  return item.first_investment_at ?? item.qualified_at ?? item.signed_up_at;
}

export function buildEarningsSeries(
  referrals: ReferralListItem[],
  period: ReferralsPeriod
): EarningsPoint[] {
  const start = periodStart(period);
  const earningReferrals = referrals.filter((item) => referralEarningsInr(item) > 0);

  const filtered = earningReferrals.filter((item) => {
    if (!start) {
      return true;
    }
    return new Date(earningsEventDate(item)) >= start;
  });

  if (filtered.length === 0) {
    return [{ label: "—", value: 0 }];
  }

  const buckets = new Map<string, number>();

  for (const item of filtered) {
    const date = new Date(earningsEventDate(item));
    let label: string;

    if (period === "this_month") {
      const week = Math.ceil(date.getDate() / 7);
      label = `Week ${week}`;
    } else if (period === "last_3_months") {
      label = date.toLocaleDateString("en-IN", { month: "short" });
    } else {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      label = `${date.getFullYear()} Q${quarter}`;
    }

    buckets.set(label, (buckets.get(label) ?? 0) + referralEarningsInr(item));
  }

  const points = Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));

  let runningTotal = 0;
  return points.map((point) => {
    runningTotal += point.value;
    return { label: point.label, value: runningTotal };
  });
}

export { initialsFromName };
