import { mapApiClientDetail, mapApiClientListItem } from "@/lib/support-console-clients-api";
import { apiRequest } from "@/lib/api-client";
import type { DistributorClientProfile, DistributorInvestor } from "@/lib/distributor-types";

const ZYND_ID_SUFFIX = "@zynd";

/** Decode route param (`%40` → `@`) and normalize Zynd client ids for API paths. */
export function decodeSupportClientReference(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/** Path segment for URLs  omits `@zynd` suffix so links stay readable. */
export function supportUserPathRef(clientCode: string): string {
  const decoded = decodeSupportClientReference(clientCode);
  if (decoded.endsWith(ZYND_ID_SUFFIX)) {
    return decoded.slice(0, -ZYND_ID_SUFFIX.length);
  }
  return decoded;
}

export function supportUserDetailHref(clientCode: string): string {
  const pathRef = supportUserPathRef(clientCode);
  return `/dashboard/users/${encodeURIComponent(pathRef)}`;
}

export async function fetchSupportUserDetail(clientId: string): Promise<DistributorClientProfile> {
  const ref = supportUserPathRef(clientId);
  const payload = await apiRequest<Awaited<ReturnType<typeof apiRequest>>>(
    `/support/console/users/${encodeURIComponent(ref)}`,
  );
  return mapApiClientDetail(payload as Parameters<typeof mapApiClientDetail>[0]);
}

export type SupportDirectoryInvestorsPage = {
  items: DistributorInvestor[];
  hasMore: boolean;
  nextOffset: number;
};

export async function listSupportDirectoryInvestorsPage(params?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<SupportDirectoryInvestorsPage> {
  const search = new URLSearchParams();
  if (params?.search?.trim()) {
    search.set("email", params.search.trim());
  }
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  if (params?.offset) {
    search.set("offset", String(params.offset));
  }
  const query = search.toString();
  const path = query ? `/support/console/users?${query}` : "/support/console/users";
  const response = await apiRequest<{
    items: Parameters<typeof mapApiClientListItem>[0][];
    has_more: boolean;
    next_offset: number;
  }>(path);
  return {
    items: response.items.map(mapApiClientListItem),
    hasMore: response.has_more,
    nextOffset: response.next_offset,
  };
}
