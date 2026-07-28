import {
  DUMMY_BRANCH_DISTRIBUTORS,
  type BranchDistributorRecord,
} from "@/lib/dummy/branch-distributors";
import { getDistributorClientProfile } from "@/lib/dummy/client-profile";
import { DUMMY_ORDERS } from "@/lib/dummy/orders";
import { DUMMY_SYSTEMATIC_PLANS } from "@/lib/dummy/systematic-plans";
import type { DistributorInvestor, DistributorOrder, DistributorSystematicPlan } from "@/lib/dummy/types";

export type BranchDistributorBookHolding = {
  id: string;
  schemeName: string;
  amcName: string;
  totalAum: number;
  clientCount: number;
  sipSharePct: number;
};

export type BranchDistributorProfile = BranchDistributorRecord & {
  mobileMasked: string;
  euin: string;
  activeSipCount: number;
  mtdInflow: number;
  lumpsumMtd: number;
  onboardingCompletePct: number;
  featuredInvestorIds: string[];
  bookHoldings: BranchDistributorBookHolding[];
};

const FEATURED_INVESTORS: Record<string, string[]> = {
  "bd-1": [
    "inv-007",
    "inv-008",
    "inv-009",
    "inv-013",
    "inv-014",
    "inv-015",
    "inv-017",
    "inv-018",
  ],
  "bd-2": ["inv-013", "inv-014", "inv-015", "inv-017", "inv-018", "inv-009", "inv-008"],
  "bd-3": ["inv-007", "inv-008", "inv-010", "inv-011"],
};

const PROFILE_EXTRAS: Record<
  string,
  Pick<
    BranchDistributorProfile,
    "mobileMasked" | "euin" | "activeSipCount" | "mtdInflow" | "lumpsumMtd" | "onboardingCompletePct"
  >
> = {
  "bd-1": {
    mobileMasked: "*****88201",
    euin: "E884120",
    activeSipCount: 342,
    mtdInflow: 18_40_000,
    lumpsumMtd: 6_25_000,
    onboardingCompletePct: 94,
  },
  "bd-2": {
    mobileMasked: "*****44102",
    euin: "E884221",
    activeSipCount: 198,
    mtdInflow: 9_80_000,
    lumpsumMtd: 3_10_000,
    onboardingCompletePct: 91,
  },
  "bd-3": {
    mobileMasked: "*****90331",
    euin: "E884019",
    activeSipCount: 14,
    mtdInflow: 1_20_000,
    lumpsumMtd: 45_000,
    onboardingCompletePct: 58,
  },
};

function buildBookHoldings(record: BranchDistributorRecord): BranchDistributorBookHolding[] {
  if (record.aum <= 0) return [];
  const share = record.aum;
  const clients = Math.max(record.clientCount, 1);
  return [
    {
      id: `${record.id}-bh1`,
      schemeName: "Zynd Flexi Cap Direct Growth",
      amcName: "Zynd Asset Management",
      totalAum: share * 0.38,
      clientCount: Math.round(clients * 0.52),
      sipSharePct: 44,
    },
    {
      id: `${record.id}-bh2`,
      schemeName: "Zynd ELSS Tax Saver Direct",
      amcName: "Zynd Asset Management",
      totalAum: share * 0.22,
      clientCount: Math.round(clients * 0.31),
      sipSharePct: 62,
    },
    {
      id: `${record.id}-bh3`,
      schemeName: "Zynd Liquid Direct Growth",
      amcName: "Zynd Asset Management",
      totalAum: share * 0.18,
      clientCount: Math.round(clients * 0.48),
      sipSharePct: 12,
    },
    {
      id: `${record.id}-bh4`,
      schemeName: "Zynd Balanced Advantage Direct",
      amcName: "Zynd Asset Management",
      totalAum: share * 0.14,
      clientCount: Math.round(clients * 0.27),
      sipSharePct: 51,
    },
    {
      id: `${record.id}-bh5`,
      schemeName: "Other schemes (aggregated)",
      amcName: "Multiple AMCs",
      totalAum: share * 0.08,
      clientCount: Math.round(clients * 0.19),
      sipSharePct: 36,
    },
  ];
}

export function branchDistributorDetailHref(distributorId: string): string {
  return `/dashboard/dist-management/distributors/${distributorId}`;
}

export function getBranchDistributorRecord(distributorId: string): BranchDistributorRecord | undefined {
  return DUMMY_BRANCH_DISTRIBUTORS.find((row) => row.id === distributorId);
}

export function getBranchDistributorProfile(distributorId: string): BranchDistributorProfile | null {
  const record = getBranchDistributorRecord(distributorId);
  if (!record) return null;
  const extras = PROFILE_EXTRAS[record.id];
  if (!extras) return null;

  return {
    ...record,
    ...extras,
    featuredInvestorIds: FEATURED_INVESTORS[record.id] ?? [],
    bookHoldings: buildBookHoldings(record),
  };
}

export function getFeaturedInvestorsForBranchDistributor(
  profile: BranchDistributorProfile,
): DistributorInvestor[] {
  return profile.featuredInvestorIds
    .map((id) => getDistributorClientProfile(id)?.investor)
    .filter((investor): investor is DistributorInvestor => investor != null);
}

export function getOrdersForBranchDistributor(profile: BranchDistributorProfile): DistributorOrder[] {
  const codes = new Set(
    getFeaturedInvestorsForBranchDistributor(profile).map((inv) => inv.clientCode),
  );
  return DUMMY_ORDERS.filter((order) => codes.has(order.clientCode)).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getSipsForBranchDistributor(
  profile: BranchDistributorProfile,
): DistributorSystematicPlan[] {
  const codes = new Set(
    getFeaturedInvestorsForBranchDistributor(profile).map((inv) => inv.clientCode),
  );
  return DUMMY_SYSTEMATIC_PLANS.filter((plan) => codes.has(plan.clientCode)).sort(
    (a, b) => new Date(b.nextDueAt).getTime() - new Date(a.nextDueAt).getTime(),
  );
}

/** Demo-only: aggregate orders/SIPs when book is larger than featured sample. */
export function getBranchDistributorActivityCounts(profile: BranchDistributorProfile) {
  const orders = getOrdersForBranchDistributor(profile);
  const sips = getSipsForBranchDistributor(profile);
  return {
    ordersShown: orders.length,
    ordersTotalLabel: profile.clientCount > orders.length ? `${profile.clientCount * 2}+` : String(orders.length),
    sipsShown: sips.length,
    sipsTotalLabel:
      profile.activeSipCount > sips.length ? String(profile.activeSipCount) : String(sips.length),
  };
}
