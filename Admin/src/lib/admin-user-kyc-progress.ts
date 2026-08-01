import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { AdminUserKycDetail } from "@/lib/admin-api";
import {
  buildAdminKycFlowSteps,
  summarizeKycProgress,
} from "@/lib/admin-user-kyc-steps";

const OVERALL_STATUS_LABELS: Record<string, string> = {
  none: "Not started",
  in_progress: "In progress",
  phase1_complete: "Phase 1 complete",
  phase2_complete: "Phase 2 complete",
  submitted: "Submitted",
  completed: "Completed",
};

export type KycHeroBadge = {
  label: string;
  variant: StatusBadgeVariant;
};

export function computeAdminKycProgress(kyc: AdminUserKycDetail) {
  const steps = buildAdminKycFlowSteps(kyc);
  const summary = summarizeKycProgress(steps);
  return {
    completed: summary.completed,
    total: summary.total,
    percent: summary.percent,
  };
}

function formatOverallStatus(status: string) {
  return OVERALL_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

function overallStatusVariant(status: string): StatusBadgeVariant {
  if (status === "completed") return "success";
  if (status === "submitted") return "warning";
  if (status === "in_progress") return "info";
  if (status === "none") return "neutral";
  return "info";
}

export function resolveKycHeroComplianceBadge(kyc: AdminUserKycDetail): KycHeroBadge {
  const isCompliant = kyc.overall_status === "completed";
  if (isCompliant) {
    return { label: "Compliant", variant: "success" };
  }

  if (kyc.kyc_already_registered) {
    return { label: "KRA compliant", variant: "success" };
  }

  if (kyc.external_kyc_status && kyc.external_kyc_status !== "returned_success") {
    return { label: "To KRA", variant: "info" };
  }

  if (kyc.overall_status === "in_progress") {
    return { label: "In progress", variant: "info" };
  }

  if (kyc.overall_status === "submitted") {
    return { label: "Submitted", variant: "warning" };
  }

  if (kyc.overall_status !== "none") {
    return {
      label: formatOverallStatus(kyc.overall_status),
      variant: overallStatusVariant(kyc.overall_status),
    };
  }

  return { label: "Pending", variant: "warning" };
}
