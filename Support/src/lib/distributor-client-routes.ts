import { buildYourClientsListHref } from "@/lib/distributor-clients-list-scope";
import type { DistributorInvestor } from "@/lib/distributor-types";

/** Where the user opened client detail from — drives back links and breadcrumbs. */
export type DistributorClientListOrigin = "your-book" | "system-resident";

export const YOUR_CLIENTS_LIST_HREF = "/dashboard/your-clients";
/** @deprecated List lives on Your clients — use buildYourClientsListHref("all"). */
export const SYSTEM_RESIDENT_INVESTORS_HREF = "/dashboard/investors/resident";

const ZYND_CLIENT_ID_SUFFIX = "@zynd";
const MISSING_CLIENT_CODE = "—";

type DistributorClientRefSource = Pick<DistributorInvestor, "id" | "clientCode">;

/** URL path segment for a client — Zynd client id, not the internal user uuid. */
export function distributorClientPathRef(
  source: DistributorClientRefSource | { id: string; clientCode?: string | null },
): string {
  const code = source.clientCode?.trim();
  if (code && code !== MISSING_CLIENT_CODE) {
    if (code.endsWith(ZYND_CLIENT_ID_SUFFIX)) {
      return code.slice(0, -ZYND_CLIENT_ID_SUFFIX.length);
    }
    return code;
  }
  return source.id;
}

function encodeClientPathRef(clientReference: string): string {
  return encodeURIComponent(clientReference);
}

export function distributorClientDetailHref(
  origin: DistributorClientListOrigin,
  clientReference: string,
): string {
  const encoded = encodeClientPathRef(clientReference);
  if (origin === "your-book") {
    return `${YOUR_CLIENTS_LIST_HREF}/${encoded}`;
  }
  return `${SYSTEM_RESIDENT_INVESTORS_HREF}/${encoded}`;
}

export function distributorClientDetailHrefForInvestor(
  origin: DistributorClientListOrigin,
  investor: DistributorClientRefSource,
): string {
  return distributorClientDetailHref(origin, distributorClientPathRef(investor));
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
