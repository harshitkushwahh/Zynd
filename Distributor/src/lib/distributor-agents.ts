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
};

export const DISTRIBUTOR_DEMO_AGENTS: DistributorAgent[] = [
  {
    id: "dist-riya",
    name: "Riya Mehta",
    email: "riya@zynd.distributor",
    password: "distributor123",
    initials: "RM",
    role: "distributor",
    branchId: "branch-andheri",
    branchName: "Mumbai — Andheri",
    branchCode: "MUM-AND",
  },
  {
    id: "dist-arjun",
    name: "Arjun Kapoor",
    email: "arjun@zynd.distributor",
    password: "distributor123",
    initials: "AK",
    role: "branch_manager",
    branchId: "branch-andheri",
    branchName: "Mumbai — Andheri",
    branchCode: "MUM-AND",
  },
];

export function findDistributorAgent(email: string, password: string): DistributorAgent | null {
  const normalized = email.trim().toLowerCase();
  return (
    DISTRIBUTOR_DEMO_AGENTS.find(
      (agent) => agent.email === normalized && agent.password === password,
    ) ?? null
  );
}
