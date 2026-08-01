import { buildYourClientsListHref } from "@/lib/distributor-clients-list-scope";

/** Where the user opened client detail from — drives back links and breadcrumbs. */
export type DistributorClientListOrigin = "your-book" | "system-resident";

export const YOUR_CLIENTS_LIST_HREF = "/dashboard/your-clients";
/** @deprecated List lives on Your clients — use buildYourClientsListHref("all"). */
export const SYSTEM_RESIDENT_INVESTORS_HREF = "/dashboard/investors/resident";

export function distributorClientDetailHref(
  origin: DistributorClientListOrigin,
  clientId: string,
): string {
  if (origin === "your-book") {
    return `${YOUR_CLIENTS_LIST_HREF}/${clientId}`;
  }
  return `${SYSTEM_RESIDENT_INVESTORS_HREF}/${clientId}`;
}

export function distributorClientFamilyGroupHref(
  origin: DistributorClientListOrigin,
  clientId: string,
  groupId: string,
): string {
  return `${distributorClientDetailHref(origin, clientId)}/family/${groupId}`;
}

/** Client detail with a profile tab selected (e.g. `?tab=family`). */
export function distributorClientDetailTabHref(
  origin: DistributorClientListOrigin,
  clientId: string,
  tab: string,
): string {
  const base = distributorClientDetailHref(origin, clientId);
  return `${base}?tab=${encodeURIComponent(tab)}`;
}

export function distributorClientListHref(origin: DistributorClientListOrigin): string {
  return origin === "your-book" ? YOUR_CLIENTS_LIST_HREF : buildYourClientsListHref("all");
}

/** @deprecated Use origin-based hrefs; kept for legacy redirects. */
export function legacyDistributorClientDetailHref(section: string, clientId: string): string {
  return `/dashboard/your-clients/${section}/${clientId}`;
}
