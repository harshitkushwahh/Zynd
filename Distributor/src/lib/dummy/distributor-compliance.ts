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

export const DUMMY_DISTRIBUTOR_COMPLIANCE_QUEUE: DistributorComplianceQueueRow[] = [
  {
    id: "dcq-1",
    clientId: "inv-002",
    clientCode: "ZYD0000193",
    clientLabel: "Client ···0193",
    issueType: "KYC pending",
    stage: "Mobile OTP pending",
    severity: "High",
    daysOpen: 41,
    updatedAt: "2026-06-16T11:40:00.000Z",
  },
  {
    id: "dcq-2",
    clientId: "inv-004",
    clientCode: "ZYD0000191",
    clientLabel: "Client ···0191",
    issueType: "KYC pending",
    stage: "Address verification",
    severity: "Medium",
    daysOpen: 19,
    updatedAt: "2026-07-08T15:10:00.000Z",
  },
  {
    id: "dcq-3",
    clientId: "inv-007",
    clientCode: "ZYD0000186",
    clientLabel: "Rahul S.",
    issueType: "Compliance exception",
    stage: "CKYC mismatch — name variance",
    severity: "High",
    daysOpen: 7,
    updatedAt: "2026-07-20T09:00:00.000Z",
  },
  {
    id: "dcq-4",
    clientId: "inv-008",
    clientCode: "ZYD0000182",
    clientLabel: "Client ···0182",
    issueType: "Document expiring",
    stage: "PAN re-verification due in 12 days",
    severity: "Medium",
    daysOpen: 3,
    updatedAt: "2026-07-24T08:45:00.000Z",
  },
  {
    id: "dcq-5",
    clientId: "inv-009",
    clientCode: "ZYD0000176",
    clientLabel: "Tanvi R.",
    issueType: "eSign pending",
    stage: "KYC form awaiting client eSign",
    severity: "Medium",
    daysOpen: 5,
    updatedAt: "2026-07-22T14:20:00.000Z",
  },
  {
    id: "dcq-6",
    clientId: "inv-010",
    clientCode: "ZYD0000184",
    clientLabel: "Client ···0184",
    issueType: "Bank verification",
    stage: "Penny drop failed — name mismatch",
    severity: "High",
    daysOpen: 2,
    updatedAt: "2026-07-25T10:30:00.000Z",
  },
  {
    id: "dcq-7",
    clientId: "inv-013",
    clientCode: "ZYD0000172",
    clientLabel: "Client ···0172",
    issueType: "Nominee incomplete",
    stage: "Nominee share allocation pending",
    severity: "Low",
    daysOpen: 11,
    updatedAt: "2026-07-16T09:15:00.000Z",
  },
];

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
