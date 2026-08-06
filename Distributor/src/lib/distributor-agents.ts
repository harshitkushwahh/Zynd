import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export type DistributorAgent = {
  id: string;
  name: string;
  email: string;
  password: string;
  initials: string;
  role: "distributor" | "relationship_manager" | "branch_manager";
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  zyndClientId?: string;
  avatarUrl?: string | null;
  /** ISO timestamp when the distributor account was created. */
  joinedAt?: string;
};

export function findDistributorAgent(_email: string, _password: string): DistributorAgent | null {
  return null;
}

export function getDemoAccountErrorMessage(): string {
  return ZYND_MITRA_COPY.demoAccountError;
}
