export type DistributorLeadStage =
  | "Invited"
  | "KYC started"
  | "KYC dropped"
  | "Ready to invest"
  | "First investment";

export type DistributorLeadSource =
  | "Referral"
  | "Walk-in"
  | "Digital invite"
  | "Marketing agency"
  | "QR code campaign"
  | "Social media"
  | "Partner campaign";

export const DISTRIBUTOR_LEAD_SOURCE_OPTIONS: Array<{
  value: DistributorLeadSource;
  label: string;
}> = [
  { value: "Referral", label: "Referral" },
  { value: "Walk-in", label: "Walk-in" },
  { value: "Digital invite", label: "Digital invite" },
  { value: "Marketing agency", label: "Marketing agency" },
  { value: "QR code campaign", label: "QR code campaign" },
  { value: "Social media", label: "Social media" },
  { value: "Partner campaign", label: "Partner campaign" },
];

export type DistributorLeadRow = {
  id: string;
  clientId: string;
  clientCode: string;
  clientLabel: string;
  emailMasked: string;
  stage: DistributorLeadStage;
  source: DistributorLeadSource;
  lastActivityAt: string;
  daysInStage: number;
};

export const DUMMY_DISTRIBUTOR_LEADS: DistributorLeadRow[] = [];

export function getDistributorLeadSummary(rows: DistributorLeadRow[]) {
  return {
    total: rows.length,
    invited: rows.filter((row) => row.stage === "Invited").length,
    kycStarted: rows.filter((row) => row.stage === "KYC started").length,
    kycDropped: rows.filter((row) => row.stage === "KYC dropped").length,
    readyToInvest: rows.filter((row) => row.stage === "Ready to invest").length,
    firstInvestment: rows.filter((row) => row.stage === "First investment").length,
  };
}

export function getDistributorLeadConversionStats(rows: DistributorLeadRow[]) {
  const summary = getDistributorLeadSummary(rows);

  return {
    total: summary.total,
    invested: summary.firstInvestment,
    /** Demo month-over-month change in conversion rate (percentage points). */
    trendVsLastMonth: 2.4,
  };
}
