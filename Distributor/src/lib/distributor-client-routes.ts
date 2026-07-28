/** Where the user opened client detail from — drives back links and breadcrumbs. */
export type DistributorClientListOrigin = "your-book" | "system-resident";

export const YOUR_CLIENTS_LIST_HREF = "/dashboard/your-clients";
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

export function distributorClientListHref(origin: DistributorClientListOrigin): string {
  return origin === "your-book" ? YOUR_CLIENTS_LIST_HREF : SYSTEM_RESIDENT_INVESTORS_HREF;
}

/** @deprecated Use origin-based hrefs; kept for legacy redirects. */
export function legacyDistributorClientDetailHref(section: string, clientId: string): string {
  return `/dashboard/your-clients/${section}/${clientId}`;
}
