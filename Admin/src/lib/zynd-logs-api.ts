import { apiRequest } from "@/lib/api-client";

export type ZyndLogSource = "cybrilla" | "fintech_primitive" | "kyckart";

export type ZyndLogItem = {
  id: string;
  source: ZyndLogSource;
  user_id: string | null;
  client_id: string | null;
  user_email: string | null;
  action: string;
  method: string;
  path: string;
  status_code: number | null;
  success: boolean;
  duration_ms: number | null;
  error_code: string | null;
  request_summary: Record<string, unknown>;
  response_summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ZyndLogListResult = {
  items: ZyndLogItem[];
  total: number;
  has_more: boolean;
  latest_at: string | null;
};

export type ZyndLogQuery = {
  source?: ZyndLogSource;
  q?: string;
  success?: boolean;
  from?: string;
  to?: string;
  since?: string;
  limit?: number;
  offset?: number;
};

function buildZyndLogsQuery(params?: ZyndLogQuery) {
  const search = new URLSearchParams();
  if (params?.source) search.set("source", params.source);
  if (params?.q) search.set("q", params.q);
  if (params?.success !== undefined) search.set("success", String(params.success));
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.since) search.set("since", params.since);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  return search.toString();
}

export async function fetchZyndLogs(params?: ZyndLogQuery) {
  const query = buildZyndLogsQuery(params);
  return apiRequest<ZyndLogListResult>(`/admin/zynd-logs${query ? `?${query}` : ""}`);
}

export async function downloadZyndLogsCsv(params?: Omit<ZyndLogQuery, "limit" | "offset" | "since">) {
  const query = buildZyndLogsQuery(params);
  const response = await fetch(`/api/v1/admin/zynd-logs/export${query ? `?${query}` : ""}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Could not export Zynd logs.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "zynd-logs.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export const ZYND_LOG_SOURCE_LABELS: Record<ZyndLogSource, string> = {
  cybrilla: "Cybrilla",
  fintech_primitive: "Fintech Primitive",
  kyckart: "KYC Kart",
};
