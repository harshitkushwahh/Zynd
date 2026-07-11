import { apiRequest } from "@/lib/api-client";

export type ReferralMeResponse = {
  code: string;
  share_url: string;
  click_count: number;
  signup_count: number;
  kyc_verified_count: number;
  first_investment_count: number;
  qualified_count: number;
  engaged_count: number;
  created_at: string;
};

export type ReferralListItem = {
  id: string;
  name: string;
  masked_email: string;
  current_stage: "signed_up" | "kyc_verified" | "first_investment" | "qualified" | "engaged";
  signup_channel: "email" | "google" | "apple";
  signed_up_at: string;
  kyc_verified_at: string | null;
  first_investment_at: string | null;
  first_investment_product: "mutual_fund" | "fixed_deposit" | "other" | null;
  first_investment_amount_inr: number | null;
  qualified_at: string | null;
  engaged_at: string | null;
  profile_image_url?: string | null;
};

export type ReferralListResponse = {
  items: ReferralListItem[];
};

export type ReferralClickResponse = {
  ok: boolean;
  code: string;
  share_path: string;
};

export type ReferralLeaderboardPeriod = "this_month" | "last_3_months" | "all_time";

export type ReferralLeaderboardEntry = {
  rank: number;
  name: string;
  referralCount: number;
  earningsInr: number;
  isCurrentUser: boolean;
  profileImageUrl?: string | null;
};

export type ReferralLeaderboardCurrentUser = {
  rank: number | null;
  referralCount: number;
  earningsInr: number;
  topPercent: number | null;
};

export type ReferralLeaderboardResponse = {
  period: ReferralLeaderboardPeriod;
  entries: ReferralLeaderboardEntry[];
  currentUser: ReferralLeaderboardCurrentUser;
};

type ReferralLeaderboardApiResponse = {
  period: ReferralLeaderboardPeriod;
  entries: {
    rank: number;
    name: string;
    referral_count: number;
    earnings_inr: number;
    is_current_user: boolean;
    profile_image_url?: string | null;
  }[];
  current_user: {
    rank: number | null;
    referral_count: number;
    earnings_inr: number;
    top_percent: number | null;
  };
};

function mapLeaderboardResponse(data: ReferralLeaderboardApiResponse): ReferralLeaderboardResponse {
  return {
    period: data.period,
    entries: data.entries.map((entry) => ({
      rank: entry.rank,
      name: entry.name,
      referralCount: entry.referral_count,
      earningsInr: entry.earnings_inr,
      isCurrentUser: entry.is_current_user,
      profileImageUrl: entry.profile_image_url ?? null,
    })),
    currentUser: {
      rank: data.current_user.rank,
      referralCount: data.current_user.referral_count,
      earningsInr: data.current_user.earnings_inr,
      topPercent: data.current_user.top_percent,
    },
  };
}

export async function fetchReferralMe() {
  return apiRequest<ReferralMeResponse>("/referrals/me");
}

export async function fetchReferralList() {
  return apiRequest<ReferralListResponse>("/referrals/referrals");
}

export async function fetchReferralLeaderboard(period: ReferralLeaderboardPeriod = "this_month") {
  const data = await apiRequest<ReferralLeaderboardApiResponse>(
    `/referrals/leaderboard?period=${encodeURIComponent(period)}`
  );
  return mapLeaderboardResponse(data);
}

export async function recordReferralClick(code: string) {
  return apiRequest<ReferralClickResponse>("/referrals/clicks", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
