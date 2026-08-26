import type {
  DistributorClientKycAuditEntry,
  DistributorClientKycAuditActor,
} from "@/lib/distributor-types";

export type { DistributorClientKycAuditEntry } from "@/lib/distributor-types";

export type ApiKycAuditEntry = {
  id: string;
  occurred_at: string;
  action: string;
  step_key?: string | null;
  step_label?: string | null;
  detail: string;
  actor: string;
  source: string;
};

const SOURCE_LABELS: Record<string, string> = {
  App: "Zynd app",
  System: "System",
  "KRA provider": "KRA",
  "Mobile app": "Mobile app",
  "Web app": "Web app",
  "Zynd app": "Zynd app",
};

function mapAuditActor(actor: string): DistributorClientKycAuditActor {
  return actor === "system" ? "system" : "investor";
}

export function mapKycAuditSourceLabel(source: string | null | undefined): string {
  const trimmed = source?.trim();
  if (!trimmed) return "—";
  return SOURCE_LABELS[trimmed] ?? trimmed;
}

export function mapKycAuditLogFromApi(
  entries: ApiKycAuditEntry[] | null | undefined,
): DistributorClientKycAuditEntry[] {
  if (!entries?.length) return [];

  return entries.map((entry) => ({
    id: entry.id,
    occurredAt: entry.occurred_at,
    action: entry.action,
    stepLabel: entry.step_label ?? null,
    detail: entry.detail,
    actor: mapAuditActor(entry.actor),
    source: mapKycAuditSourceLabel(entry.source),
  }));
}
