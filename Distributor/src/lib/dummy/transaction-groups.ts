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
