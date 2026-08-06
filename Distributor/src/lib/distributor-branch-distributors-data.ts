import type { DistributorPartnerListItem } from "@/lib/distributor-partners-api";

export type BranchDistributorStatus =
  | "Active"
  | "Former"
  | "Paused"
  | "Pending review"
  | "Pending password"
  | "Rejected";

export type BranchDistributorRecord = {
  id: string;
  name: string;
  email: string;
  arn: string;
  clientCount: number;
  aum: number;
  status: BranchDistributorStatus;
  joinedAt: string;
  onboardingStatus?: string;
};

export function mapPartnerListItemToBranchRecord(item: DistributorPartnerListItem): BranchDistributorRecord {
  const status: BranchDistributorStatus =
    item.status === "Active" ||
    item.status === "Former" ||
    item.status === "Paused" ||
    item.status === "Pending review" ||
    item.status === "Pending password" ||
    item.status === "Rejected"
      ? item.status
      : "Paused";

  return {
    id: item.client_id,
    name: item.name,
    email: item.email,
    arn: item.arn || "—",
    clientCount: item.client_count,
    aum: item.aum,
    status,
    joinedAt: item.joined_at,
    onboardingStatus: item.onboarding_status,
  };
}

/** @deprecated Use fetched partners from API; kept empty for legacy report/profile helpers. */
export const DUMMY_BRANCH_DISTRIBUTORS: BranchDistributorRecord[] = [];
