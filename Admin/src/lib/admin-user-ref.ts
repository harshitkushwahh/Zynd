const ZYND_ID_SUFFIX = "@zynd";

export function clientIdToProfilePath(clientId: string) {
  const normalized = decodeURIComponent(clientId.trim());
  if (normalized.endsWith(ZYND_ID_SUFFIX)) {
    return normalized.slice(0, -ZYND_ID_SUFFIX.length);
  }
  return normalized;
}

export function profilePathToClientId(pathSegment: string) {
  const normalized = decodeURIComponent(pathSegment.trim());
  if (!normalized) return normalized;
  if (normalized.includes("@")) return normalized;
  return `${normalized}${ZYND_ID_SUFFIX}`;
}

/** Path segment for admin API routes and dashboard URLs (Zynd id without @zynd). */
export function userRefToPath(userRef: string) {
  return clientIdToProfilePath(userRef);
}

/** Prefer Zynd client id; fall back to internal user id when legacy data lacks client_id. */
export function pickUserRef(item: {
  client_id?: string | null;
  user_id?: string | null;
}) {
  const clientId = item.client_id?.trim();
  if (clientId) return clientId;
  return item.user_id?.trim() ?? "";
}

export function displayZyndId(userRef: string) {
  const normalized = userRef.trim();
  if (!normalized) return "—";
  if (normalized.includes("@")) return normalized;
  return profilePathToClientId(normalized);
}

export function userDashboardProfileHref(userRef: string, tab = "portfolio") {
  const path = userRefToPath(pickUserRef({ client_id: userRef, user_id: userRef }));
  return `/dashboard/users/${encodeURIComponent(path)}/${tab}`;
}

export function distributorStateHeadHref(userRef: string) {
  return `/dashboard/distributor-head/state-heads/${encodeURIComponent(userRefToPath(userRef))}`;
}

export function distributorStateHeadTabHref(userRef: string, tabSlug: string) {
  const base = distributorStateHeadHref(userRef);
  if (!tabSlug || tabSlug === "overview") return base;
  return `${base}/${tabSlug}`;
}

export function matchesUserRef(
  entityId: string,
  item: { client_id?: string | null; user_id?: string | null },
) {
  const normalized = decodeURIComponent(entityId.trim());
  const clientId = item.client_id?.trim();
  if (clientId) {
    if (clientId === normalized) return true;
    if (userRefToPath(clientId) === normalized) return true;
  }
  return item.user_id?.trim() === normalized;
}

export type UserIdentityFields = {
  user_id: string;
  client_id: string;
};
