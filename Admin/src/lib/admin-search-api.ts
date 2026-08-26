import { apiRequest } from "@/lib/api-client";

export type AdminSearchScope =
  | "users"
  | "referrals.referrers"
  | "referrals.attributions"
  | "referrals.redemptions"
  | "referrals.reward_rules"
  | "referrals.leaderboard";

export type AdminSearchGroup<T = Record<string, unknown>> = {
  scope: string;
  total: number;
  items: T[];
};

export type AdminSearchResult<T = Record<string, unknown>> = {
  query: string;
  scope: string | null;
  total: number;
  limit: number;
  offset: number;
  took_ms: number;
  cached: boolean;
  items: T[];
  groups?: AdminSearchGroup<T>[] | null;
};

export async function searchAdmin<T = Record<string, unknown>>(params: {
  scope?: AdminSearchScope;
  scopes?: AdminSearchScope[];
  q?: string;
  limit?: number;
  offset?: number;
  stage?: string;
  status?: string;
  period?: string;
}) {
  const query = new URLSearchParams();
  if (params.scope) query.set("scope", params.scope);
  if (params.scopes?.length) query.set("scopes", params.scopes.join(","));
  if (params.q) query.set("q", params.q);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  if (params.stage) query.set("stage", params.stage);
  if (params.status) query.set("status", params.status);
  if (params.period) query.set("period", params.period);
  return apiRequest<AdminSearchResult<T>>(`/admin/search?${query.toString()}`);
}
