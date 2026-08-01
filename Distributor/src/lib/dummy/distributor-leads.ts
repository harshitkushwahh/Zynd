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

export const DUMMY_DISTRIBUTOR_LEADS: DistributorLeadRow[] = [
  {
    id: "dl-1",
    clientId: "inv-002",
    clientCode: "ZYD0000193",
    clientLabel: "Client ···0193",
    emailMasked: "vi*******41@gmail.com",
    stage: "KYC started",
    source: "Digital invite",
    lastActivityAt: "2026-07-27T09:20:00.000Z",
    daysInStage: 41,
  },
  {
    id: "dl-2",
    clientId: "inv-004",
    clientCode: "ZYD0000191",
    clientLabel: "Client ···0191",
    emailMasked: "an********92@gmail.com",
    stage: "KYC started",
    source: "Referral",
    lastActivityAt: "2026-07-26T16:45:00.000Z",
    daysInStage: 19,
  },
  {
    id: "dl-3",
    clientId: "inv-014",
    clientCode: "ZYD0000168",
    clientLabel: "Client ···0168",
    emailMasked: "pr********08@gmail.com",
    stage: "Invited",
    source: "Walk-in",
    lastActivityAt: "2026-07-28T11:00:00.000Z",
    daysInStage: 2,
  },
  {
    id: "dl-4",
    clientId: "inv-015",
    clientCode: "ZYD0000165",
    clientLabel: "Client ···0165",
    emailMasked: "sh********33@gmail.com",
    stage: "KYC dropped",
    source: "Marketing agency",
    lastActivityAt: "2026-07-15T08:30:00.000Z",
    daysInStage: 13,
  },
  {
    id: "dl-5",
    clientId: "inv-016",
    clientCode: "ZYD0000162",
    clientLabel: "Client ···0162",
    emailMasked: "me********77@gmail.com",
    stage: "Ready to invest",
    source: "QR code campaign",
    lastActivityAt: "2026-07-27T14:10:00.000Z",
    daysInStage: 1,
  },
  {
    id: "dl-6",
    clientId: "inv-017",
    clientCode: "ZYD0000159",
    clientLabel: "Client ···0159",
    emailMasked: "ka********21@gmail.com",
    stage: "First investment",
    source: "Referral",
    lastActivityAt: "2026-07-26T10:05:00.000Z",
    daysInStage: 0,
  },
  {
    id: "dl-7",
    clientId: "inv-018",
    clientCode: "ZYD0000156",
    clientLabel: "Client ···0156",
    emailMasked: "ro********65@gmail.com",
    stage: "Invited",
    source: "Social media",
    lastActivityAt: "2026-07-28T07:40:00.000Z",
    daysInStage: 1,
  },
  {
    id: "dl-8",
    clientId: "inv-019",
    clientCode: "ZYD0000153",
    clientLabel: "Client ···0153",
    emailMasked: "ni********18@gmail.com",
    stage: "KYC started",
    source: "Partner campaign",
    lastActivityAt: "2026-07-25T13:20:00.000Z",
    daysInStage: 6,
  },
  {
    id: "dl-9",
    clientId: "inv-020",
    clientCode: "ZYD0000150",
    clientLabel: "Client ···0150",
    emailMasked: "de********54@gmail.com",
    stage: "Invited",
    source: "QR code campaign",
    lastActivityAt: "2026-07-28T09:15:00.000Z",
    daysInStage: 0,
  },
];

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
