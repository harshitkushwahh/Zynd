import type { MfSipPlan } from "@/features/invest/api/invest-api";

export type MfSipStatusFilter = "all" | "active" | "pending" | "cancelled" | "failed";

export type MfSipFilters = {
  status: MfSipStatusFilter;
};

export const EMPTY_MF_SIP_FILTERS: MfSipFilters = {
  status: "all",
};

export function hasActiveMfSipFilters(filters: MfSipFilters) {
  return filters.status !== "all";
}

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

export function matchesSipStatus(plan: MfSipPlan, filter: MfSipStatusFilter) {
  if (filter === "all") return true;
  const status = normalizeStatus(plan.status ?? "");
  if (filter === "active") return status === "ACTIVE";
  if (filter === "cancelled") return status === "CANCELLED";
  if (filter === "failed") return status === "FAILED";
  if (filter === "pending") {
    return ["PENDING", "REVIEW", "CONSENT_PENDING"].includes(status);
  }
  return true;
}

export function applyMfSipFilters(plans: MfSipPlan[], filters: MfSipFilters) {
  return plans.filter((plan) => matchesSipStatus(plan, filters.status));
}

export function sortMfSipPlans(plans: MfSipPlan[]) {
  return [...plans].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}
