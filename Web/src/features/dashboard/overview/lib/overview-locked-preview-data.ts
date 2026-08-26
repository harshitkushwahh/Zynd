import type { OverviewHoldingCardItem } from "@/features/dashboard/overview/lib/overview-holdings-preview";
import type { OverviewPortfolioPreview } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import type { OverviewPortfolioFlowPoint } from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";
import type { Goal } from "@/features/goals/api/goals-api";
import type { MfOrder } from "@/features/invest/api/invest-api";
import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";

/** Blurred placeholder content for locked overview cards only. */

export const OVERVIEW_PORTFOLIO_LOCKED_PREVIEW: OverviewPortfolioPreview = {
  currentValueInr: 4_28_650,
  investedInr: 3_81_400,
  totalReturnInr: 47_250,
  totalReturnPct: 12.4,
  dayChangeInr: 3_420,
  dayChangePct: 0.8,
  xirrPct: 14.2,
  holdingsCount: 5,
  activeSipsCount: 2,
  monthlySipInr: 15_000,
  growth: [],
  allocation: [],
};

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function buildLockedPortfolioFlowSeries(): OverviewPortfolioFlowPoint[] {
  const points: OverviewPortfolioFlowPoint[] = [];
  const endDate = new Date();
  endDate.setHours(12, 0, 0, 0);
  const totalMonths = 120;
  const endValue = OVERVIEW_PORTFOLIO_LOCKED_PREVIEW.currentValueInr;
  const endInvested = OVERVIEW_PORTFOLIO_LOCKED_PREVIEW.investedInr;

  for (let index = 0; index <= totalMonths; index += 1) {
    const date = new Date(endDate);
    date.setMonth(date.getMonth() - (totalMonths - index));

    const progress = index / totalMonths;
    const invested = Math.round(endInvested * (0.22 + 0.78 * progress ** 1.05));
    const gainFactor = 1 + 0.124 * progress ** 1.15 + Math.sin(index / 4.5) * 0.012;
    const value = Math.round(Math.max(invested, invested * gainFactor));

    points.push({
      date: date.toISOString().slice(0, 10),
      label: monthLabel(date),
      invested,
      value: index === totalMonths ? endValue : value,
    });
  }

  points[points.length - 1] = {
    ...points[points.length - 1]!,
    invested: endInvested,
    value: endValue,
  };

  return points;
}

export const OVERVIEW_PORTFOLIO_FLOW_LOCKED_SERIES = buildLockedPortfolioFlowSeries();

export const OVERVIEW_HOLDINGS_LOCKED_PREVIEW: OverviewHoldingCardItem[] = [
  {
    id: "locked-hdfc-midcap",
    fundName: "HDFC Mid-Cap Opportunities Fund",
    amcName: "HDFC Mutual Fund",
    amcLogoUrl: null,
    investedInr: 74_500,
    returnPct: 4.21,
  },
  {
    id: "locked-sbi-small-cap",
    fundName: "SBI Small Cap Fund",
    amcName: "SBI Mutual Fund",
    amcLogoUrl: null,
    investedInr: 38_000,
    returnPct: -1.02,
  },
  {
    id: "locked-icici-bluechip",
    fundName: "ICICI Pru Bluechip Fund",
    amcName: "ICICI Prudential Mutual Fund",
    amcLogoUrl: null,
    investedInr: 58_900,
    returnPct: 2.35,
  },
];

export type OverviewSipLockedPreview = {
  id: string;
  amcName: string;
  amountInr: number;
};

export const OVERVIEW_SIPS_LOCKED_PREVIEW: OverviewSipLockedPreview[] = [
  { id: "locked-sip-hdfc", amcName: "HDFC Mutual Fund", amountInr: 5_000 },
  { id: "locked-sip-sbi", amcName: "SBI Mutual Fund", amountInr: 3_000 },
  { id: "locked-sip-axis", amcName: "Axis Mutual Fund", amountInr: 2_500 },
];

/** Blurred risk gauge placeholder for the overview square card. */
export const OVERVIEW_RISK_LOCKED_SCORE = 610;
export const OVERVIEW_RISK_LOCKED_TIER = "growth" as const;
export const OVERVIEW_RISK_LOCKED_DISPLAY_SCORE = 61;

export type OverviewFamilyLockedPreview = {
  groupTitle: string;
  currentValueInr: number;
  goalTargetInr: number;
  investedInr: number;
  returnPct: number;
  members: FamilyGroupMemberPreview[];
};

export const OVERVIEW_FAMILY_LOCKED_PREVIEW: OverviewFamilyLockedPreview = {
  groupTitle: "Kushwah Family",
  currentValueInr: 12_50_000,
  goalTargetInr: 25_00_000,
  investedInr: 9_80_000,
  returnPct: 8.42,
  members: [
    {
      user_id: "locked-family-head",
      display_name: "Rahul Kushwah",
      display_nickname: null,
      role: "head",
      profile_image_url: null,
      badge_label: null,
      joined_at: "2025-01-01T00:00:00.000Z",
    },
    {
      user_id: "locked-family-member-1",
      display_name: "Priya Kushwah",
      display_nickname: null,
      role: "contributor",
      profile_image_url: null,
      badge_label: null,
      joined_at: "2025-02-01T00:00:00.000Z",
    },
    {
      user_id: "locked-family-member-2",
      display_name: "Arjun Kushwah",
      display_nickname: null,
      role: "contributor",
      profile_image_url: null,
      badge_label: null,
      joined_at: "2025-03-01T00:00:00.000Z",
    },
    {
      user_id: "locked-family-member-3",
      display_name: "Meera Kushwah",
      display_nickname: null,
      role: "contributor",
      profile_image_url: null,
      badge_label: null,
      joined_at: "2025-04-01T00:00:00.000Z",
    },
  ],
};

export const OVERVIEW_TRANSACTIONS_LOCKED_PREVIEW: MfOrder[] = [
  {
    order_id: "locked-txn-1",
    checkout_id: null,
    product_id: "locked-product-1",
    product_name: "HDFC Flexi Cap Fund",
    product_slug: "hdfc-flexi-cap-fund",
    amc_name: "HDFC Mutual Fund",
    amc_slug: "hdfc-mutual-fund",
    amc_logo_url: null,
    order_type: "LUMPSUM",
    amount_inr: 25_000,
    payment_method: "upi",
    status: "SUCCESSFUL",
    fp_purchase_id: null,
    fp_purchase_old_id: null,
    fp_state: null,
    payment_url: null,
    next_action: null,
    failure_code: null,
    failure_reason: null,
    created_at: "2026-07-18T10:30:00.000Z",
    submitted_at: null,
    settled_at: null,
  },
  {
    order_id: "locked-txn-2",
    checkout_id: null,
    product_id: "locked-product-2",
    product_name: "SBI Bluechip Fund",
    product_slug: "sbi-bluechip-fund",
    amc_name: "SBI Mutual Fund",
    amc_slug: "sbi-mutual-fund",
    amc_logo_url: null,
    order_type: "SIP",
    amount_inr: 5_000,
    payment_method: "upi",
    status: "SUCCESSFUL",
    fp_purchase_id: null,
    fp_purchase_old_id: null,
    fp_state: null,
    payment_url: null,
    next_action: null,
    failure_code: null,
    failure_reason: null,
    created_at: "2026-07-12T08:15:00.000Z",
    submitted_at: null,
    settled_at: null,
  },
  {
    order_id: "locked-txn-3",
    checkout_id: null,
    product_id: "locked-product-3",
    product_name: "Axis Midcap Fund",
    product_slug: "axis-midcap-fund",
    amc_name: "Axis Mutual Fund",
    amc_slug: "axis-mutual-fund",
    amc_logo_url: null,
    order_type: "SIP",
    amount_inr: 3_000,
    payment_method: "upi",
    status: "PENDING",
    fp_purchase_id: null,
    fp_purchase_old_id: null,
    fp_state: null,
    payment_url: null,
    next_action: null,
    failure_code: null,
    failure_reason: null,
    created_at: "2026-07-05T14:00:00.000Z",
    submitted_at: null,
    settled_at: null,
  },
];

export const OVERVIEW_GOALS_LOCKED_PREVIEW: Goal[] = [
  {
    id: "locked-goal-home",
    user_id: "preview",
    title: "Dream Home",
    target_amount_inr: 8_00_000,
    target_date: "2030-06-01",
    current_amount_inr: 3_20_000,
    existing_savings_inr: 0,
    status: "active",
    progress_pct: 40,
    priority: 1,
    template: {
      id: "locked-template-home",
      slug: "home",
      name: "Home",
      icon_key: "home",
      default_tenure_months: 120,
      is_active: true,
      sort_order: 1,
    },
  },
  {
    id: "locked-goal-education",
    user_id: "preview",
    title: "Education Fund",
    target_amount_inr: 15_00_000,
    target_date: "2032-04-01",
    current_amount_inr: 4_50_000,
    existing_savings_inr: 0,
    status: "active",
    progress_pct: 30,
    priority: 2,
    template: {
      id: "locked-template-education",
      slug: "education",
      name: "Education",
      icon_key: "graduation-cap",
      default_tenure_months: 96,
      is_active: true,
      sort_order: 2,
    },
  },
];
