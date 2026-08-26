export type DistributorComplianceIssueType =
  | "KYC pending"
  | "eSign pending"
  | "Bank verification"
  | "Nominee incomplete"
  | "Document expiring"
  | "Compliance exception";

export type DistributorComplianceQueueRow = {
  id: string;
  clientId: string;
  clientCode: string;
  clientLabel: string;
  issueType: DistributorComplianceIssueType;
  stage: string;
  severity: "High" | "Medium" | "Low";
  daysOpen: number;
  updatedAt: string;
};

export const DUMMY_DISTRIBUTOR_COMPLIANCE_QUEUE: DistributorComplianceQueueRow[] = [];

export function getDistributorComplianceSummary(rows: DistributorComplianceQueueRow[]) {
  return {
    total: rows.length,
    kycPending: rows.filter((row) => row.issueType === "KYC pending").length,
    eSignPending: rows.filter((row) => row.issueType === "eSign pending").length,
    bankVerification: rows.filter((row) => row.issueType === "Bank verification").length,
    highPriority: rows.filter((row) => row.severity === "High").length,
  };
}

/** Demo count of compliance issues resolved in the current month. */
export const DUMMY_DISTRIBUTOR_COMPLIANCE_RESOLVED_MTD = 12;

export function getDistributorComplianceResolutionStats(rows: DistributorComplianceQueueRow[]) {
  const pending = rows.length;
  const resolved = DUMMY_DISTRIBUTOR_COMPLIANCE_RESOLVED_MTD;
  const total = pending + resolved;
  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return {
    pending,
    resolved,
    total,
    resolvedPct,
  };
}
