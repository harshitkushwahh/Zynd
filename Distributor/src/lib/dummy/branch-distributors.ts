export type BranchDistributorStatus = "Active" | "Former" | "Paused";

export type BranchDistributorRecord = {
  id: string;
  name: string;
  email: string;
  arn: string;
  clientCount: number;
  aum: number;
  status: BranchDistributorStatus;
  joinedAt: string;
};

export const DUMMY_BRANCH_DISTRIBUTORS: BranchDistributorRecord[] = [
  {
    id: "bd-1",
    name: "Riya Mehta",
    email: "riya@zynd.distributor",
    arn: "ARN-884120",
    clientCount: 128,
    aum: 4_82_00_000,
    status: "Active",
    joinedAt: "2024-03-12T00:00:00.000Z",
  },
  {
    id: "bd-2",
    name: "Neha Desai",
    email: "neha@zynd.distributor",
    arn: "ARN-884221",
    clientCount: 76,
    aum: 2_15_00_000,
    status: "Active",
    joinedAt: "2025-01-08T00:00:00.000Z",
  },
  {
    id: "bd-3",
    name: "Vikram Singh",
    email: "vikram@zynd.distributor",
    arn: "ARN-884019",
    clientCount: 12,
    aum: 38_50_000,
    status: "Paused",
    joinedAt: "2026-06-02T00:00:00.000Z",
  },
  {
    id: "bd-4",
    name: "Arjun Patel",
    email: "arjun@zynd.distributor",
    arn: "ARN-883902",
    clientCount: 54,
    aum: 92_00_000,
    status: "Former",
    joinedAt: "2022-11-18T00:00:00.000Z",
  },
];
