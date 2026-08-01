import type { DistributorTransactionGroup } from "@/lib/dummy/types";

export const DUMMY_TRANSACTION_GROUPS: DistributorTransactionGroup[] = [
  {
    id: "grp-001",
    groupRef: "GRP-4410",
    label: "July lump-sum basket",
    investorCount: 4,
    legCount: 6,
    totalAmount: 24500,
    status: "Submitted",
    createdAt: "2026-07-20T12:00:00.000Z",
  },
  {
    id: "grp-002",
    groupRef: "GRP-4409",
    label: "NRI top-up batch",
    investorCount: 2,
    legCount: 3,
    totalAmount: 18000,
    status: "Completed",
    createdAt: "2026-07-12T09:30:00.000Z",
  },
  {
    id: "grp-003",
    groupRef: "GRP-4408",
    label: "SIP kickoff — new RI book",
    investorCount: 5,
    legCount: 5,
    totalAmount: 7500,
    status: "Draft",
    createdAt: "2026-07-22T16:10:00.000Z",
  },
];

export const DUMMY_PLATFORM_TRANSACTION_GROUPS: DistributorTransactionGroup[] = [
  {
    id: "grp-p-001",
    groupRef: "GRP-4390",
    label: "Platform DIY lump-sum batch",
    investorCount: 8,
    legCount: 12,
    totalAmount: 52000,
    status: "Submitted",
    createdAt: "2026-07-21T09:00:00.000Z",
    inDistributorBook: false,
  },
  {
    id: "grp-p-002",
    groupRef: "GRP-4389",
    label: "Cross-branch SIP sync",
    investorCount: 6,
    legCount: 6,
    totalAmount: 12000,
    status: "Completed",
    createdAt: "2026-07-14T13:45:00.000Z",
    inDistributorBook: false,
  },
];

export type TransactionGroupsListScope = "your-book" | "all";

export function getTransactionGroupsForListScope(
  scope: TransactionGroupsListScope,
): DistributorTransactionGroup[] {
  if (scope === "all") {
    return [...DUMMY_TRANSACTION_GROUPS, ...DUMMY_PLATFORM_TRANSACTION_GROUPS];
  }
  return DUMMY_TRANSACTION_GROUPS.filter((group) => group.inDistributorBook !== false);
}
