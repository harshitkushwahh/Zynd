import type { AdminHierarchyBranchDetail } from "@/lib/admin-distributor-hierarchy-api";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";

export type BranchActivityEventKind =
  | "opening_request"
  | "approval"
  | "rejection"
  | "manager_assignment";

export type BranchActivityEvent = {
  id: string;
  kind: BranchActivityEventKind;
  eventLabel: string;
  actorName: string;
  actorEmail: string | null;
  summary: string;
  occurredAt: string | null;
};

export function buildBranchActivityEvents(branch: AdminHierarchyBranchDetail): BranchActivityEvent[] {
  const items: BranchActivityEvent[] = [
    {
      id: "created",
      kind: "opening_request",
      eventLabel: "Opening request submitted",
      actorName: branch.created_by_name ?? "Branch creator",
      actorEmail: branch.created_by_email,
      summary: `Opening request for ${branch.name}${branch.city ? ` (${branch.city})` : ""}`,
      occurredAt: branch.created_at,
    },
  ];

  if (branch.approved_at && branch.status === "active") {
    items.push({
      id: "approved",
      kind: "approval",
      eventLabel: "Opening approved",
      actorName: branch.approved_by_name ?? "Approver",
      actorEmail: branch.approved_by_email,
      summary: `${branch.name} is active and ready for manager assignment`,
      occurredAt: branch.approved_at,
    });
  }

  if (branch.approved_at && branch.status === "rejected") {
    items.push({
      id: "rejected",
      kind: "rejection",
      eventLabel: "Opening rejected",
      actorName: branch.approved_by_name ?? "Approver",
      actorEmail: branch.approved_by_email,
      summary: branch.rejection_reason ?? "Opening request was declined",
      occurredAt: branch.approved_at,
    });
  }

  if (branch.manager_id && branch.manager_name) {
    items.push({
      id: "manager",
      kind: "manager_assignment",
      eventLabel: `${MITRA_HIERARCHY_COPY.branchManager} assigned`,
      actorName: branch.manager_name,
      actorEmail: branch.manager_email,
      summary: `${branch.manager_name} assigned to ${branch.name}`,
      occurredAt: branch.updated_at,
    });
  }

  return items.sort((a, b) => {
    const aTime = a.occurredAt ? Date.parse(a.occurredAt) : 0;
    const bTime = b.occurredAt ? Date.parse(b.occurredAt) : 0;
    return bTime - aTime;
  });
}

export function matchesBranchActivitySearch(event: BranchActivityEvent, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    event.eventLabel.toLowerCase().includes(normalized) ||
    event.actorName.toLowerCase().includes(normalized) ||
    (event.actorEmail?.toLowerCase().includes(normalized) ?? false) ||
    event.summary.toLowerCase().includes(normalized)
  );
}

export function branchActivityKindLabel(kind: BranchActivityEventKind) {
  if (kind === "opening_request") return "Opening request";
  if (kind === "approval") return "Approval";
  if (kind === "rejection") return "Rejection";
  return "Manager assignment";
}

export function branchActivityKindVariant(kind: BranchActivityEventKind) {
  if (kind === "approval") return "success" as const;
  if (kind === "rejection") return "destructive" as const;
  if (kind === "manager_assignment") return "info" as const;
  return "neutral" as const;
}
