import type { DistributorAgent } from "@/lib/distributor-agents";

export type DistributorSessionUser = Omit<DistributorAgent, "password"> & {
  authMode?: "demo" | "api";
};
