import type { BranchDistributorProfile } from "@/lib/distributor-domain-types";
import type { DistributorPartnerDetail } from "@/lib/distributor-partners-api";

export type { BranchDistributorBookHolding, BranchDistributorProfile } from "@/lib/distributor-domain-types";

export function branchDistributorDetailHref(mitraClientId: string): string {
  return `/dashboard/dist-management/distributors/${encodeURIComponent(mitraClientId)}`;
}

export function mapPartnerDetailToBranchProfile(detail: DistributorPartnerDetail): BranchDistributorProfile {
  return {
    id: detail.client_id,
    name: detail.name,
    email: detail.email,
    arn: detail.arn || "—",
    clientCount: detail.client_count,
    aum: detail.aum,
    status: detail.status as BranchDistributorProfile["status"],
    joinedAt: detail.joined_at,
    avatarUrl: detail.profile_image_url ?? null,
    mobile: detail.mobile,
    mobileMasked: detail.mobile_masked,
    branchName: detail.branch_name,
    address: {
      line1: detail.address.line1,
      line2: detail.address.line2,
      city: detail.address.city,
      state: detail.address.state,
      postalCode: detail.address.pincode,
      country: detail.address.country,
    },
    euin: detail.euin || "—",
    activeSipCount: detail.active_sip_count,
    mtdInflow: detail.mtd_inflow,
    lumpsumMtd: detail.lumpsum_mtd,
    onboardingCompletePct: detail.onboarding_complete_pct,
    featuredInvestorIds: [],
    bookHoldings: [],
  };
}

export function getFeaturedInvestorsForBranchDistributor(
  _profile: BranchDistributorProfile,
) {
  return [];
}

export function getOrdersForBranchDistributor(_profile: BranchDistributorProfile) {
  return [];
}

export function getSipsForBranchDistributor(_profile: BranchDistributorProfile) {
  return [];
}

export function getBranchDistributorActivityCounts(_profile: BranchDistributorProfile) {
  return {
    activeClients: 0,
    pendingOrders: 0,
    activeSips: 0,
    openCompliance: 0,
  };
}

export function getBranchDistributorBookHoldings(_profile: BranchDistributorProfile) {
  return [];
}
