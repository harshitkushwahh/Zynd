/** Agent-scoped dummy assignee id aligned with support ticket seed data. */
export const SUPPORT_OVERVIEW_AGENT_ASSIGNEE = "support-agent-1";

export type SupportOverviewTrendPoint = {
  day: string;
  open: number;
  inProgress: number;
  resolved: number;
};

export const SUPPORT_OVERVIEW_TICKET_TRENDS: SupportOverviewTrendPoint[] = [
  { day: "Mon", open: 6, inProgress: 4, resolved: 3 },
  { day: "Tue", open: 8, inProgress: 5, resolved: 4 },
  { day: "Wed", open: 7, inProgress: 6, resolved: 5 },
  { day: "Thu", open: 9, inProgress: 5, resolved: 6 },
  { day: "Fri", open: 8, inProgress: 7, resolved: 7 },
  { day: "Sat", open: 6, inProgress: 4, resolved: 5 },
  { day: "Sun", open: 5, inProgress: 3, resolved: 4 },
];

export type SupportOverviewCategorySegment = {
  id: string;
  label: string;
  count: number;
  fill: string;
};

export const SUPPORT_OVERVIEW_CATEGORY_SEGMENTS: SupportOverviewCategorySegment[] = [
  { id: "kyc", label: "KYC issue", count: 32, fill: "var(--chart-1)" },
  { id: "investment", label: "Investment", count: 28, fill: "var(--chart-2)" },
  { id: "account", label: "Account & login", count: 20, fill: "var(--chart-3)" },
  { id: "payment", label: "Transactions", count: 18, fill: "var(--chart-4)" },
  { id: "documents", label: "Document upload", count: 14, fill: "var(--chart-5)" },
  { id: "other", label: "Others", count: 12, fill: "var(--muted-foreground)" },
];

export const SUPPORT_OVERVIEW_SLA = {
  compliancePct: 87,
  resolvedWithinSla: 107,
  breachedSla: 17,
};

export const SUPPORT_OVERVIEW_PERFORMANCE = {
  firstResponse: { label: "1h 24m", trendPct: -28 },
  avgResolution: { label: "6h 32m", trendPct: -18 },
  satisfaction: { label: "4.7 / 5", trendPct: 6 },
};

export const SUPPORT_OVERVIEW_METRIC_TRENDS = {
  total: 12,
  open: 8,
  inProgress: 5,
  resolved: 14,
};

export const SUPPORT_OVERVIEW_SPARKLINE = {
  total: [18, 20, 19, 22, 24, 23, 26],
  open: [10, 11, 9, 12, 11, 10, 9],
  inProgress: [6, 7, 8, 7, 8, 6, 7],
  resolved: [8, 9, 10, 11, 12, 13, 14],
};
