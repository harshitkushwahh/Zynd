import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export type DistributorNetSalesTrendPoint = {
  month: string;
  netSales: number;
};

export type DistributorNetSalesChartPeriod = "1M" | "6M" | "1Y" | "3Y" | "5Y" | "10Y";

export const DISTRIBUTOR_NET_SALES_CHART_PERIODS: DistributorNetSalesChartPeriod[] = [
  "1M",
  "6M",
  "1Y",
  "3Y",
  "5Y",
  "10Y",
];

const NET_SALES_PERIOD_POINT_COUNT: Record<DistributorNetSalesChartPeriod, number> = {
  "1M": 2,
  "6M": 6,
  "1Y": 12,
  "3Y": 36,
  "5Y": 60,
  "10Y": 120,
};

export type DistributorNetSalesHyperCardData = {
  label: string;
  currentAmount: number;
  previousAmount: number;
  changePct: number;
  sipInflowMtd: number;
  redemptionsMtd: number;
  periodYear: string;
  periodMonth: string;
};

export type DistributorReportFormat = "PDF" | "Excel" | "CSV";

export type DistributorReportTemplatePeriod = "6M" | "1Y" | "3Y" | "5Y" | "10Y";

export const DISTRIBUTOR_REPORT_TEMPLATE_PERIOD_OPTIONS: Array<{
  value: DistributorReportTemplatePeriod;
  label: string;
}> = [
  { value: "6M", label: "Last 6M" },
  { value: "1Y", label: "Last 1Y" },
  { value: "3Y", label: "Last 3Y" },
  { value: "5Y", label: "Last 5Y" },
  { value: "10Y", label: "Last 10Y" },
];

export type DistributorReportTemplate = {
  id: string;
  name: string;
  description: string;
  category: "Book" | "Incentives" | "Compliance" | "Growth";
  formats: DistributorReportFormat[];
};

export type DistributorReportExportPeriodFilter = "last-month" | "last-year";

export const DISTRIBUTOR_REPORT_EXPORT_PERIOD_OPTIONS: Array<{
  value: DistributorReportExportPeriodFilter;
  label: string;
}> = [
  { value: "last-month", label: "Last month" },
  { value: "last-year", label: "Last year" },
];

export type DistributorReportExportRow = {
  id: string;
  reportName: string;
  format: DistributorReportFormat;
  generatedAt: string;
  periodLabel: string;
  fileSizeLabel: string;
};

const DISTRIBUTOR_REPORT_EXPORTS_REFERENCE_DATE = new Date("2026-07-30T12:00:00.000Z");

export function matchesDistributorReportExportPeriod(
  generatedAt: string,
  filter: DistributorReportExportPeriodFilter,
  referenceDate: Date = DISTRIBUTOR_REPORT_EXPORTS_REFERENCE_DATE,
): boolean {
  const date = new Date(generatedAt);

  if (filter === "last-month") {
    const previousMonthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
    return (
      date.getFullYear() === previousMonthStart.getFullYear() &&
      date.getMonth() === previousMonthStart.getMonth()
    );
  }

  return date.getFullYear() === referenceDate.getFullYear() - 1;
}

export type DistributorBookTrendPoint = {
  month: string;
  aum: number;
  netSales: number;
  clientCount: number;
};

export type DistributorReportBookCompositionRow = {
  id: string;
  label: string;
  amount: number;
  sharePct: number;
};

export type DistributorReportAumMovementRow = {
  id: string;
  label: string;
  amount: number;
};

export type DistributorReportSipTrendPoint = {
  month: string;
  inflow: number;
  activeSips: number;
};

export type DistributorReportIncentiveTrendPoint = {
  month: string;
  earned: number;
  paid: number;
};

export type DistributorReportIncentiveCategoryRow = {
  id: string;
  label: string;
  amount: number;
  sharePct: number;
};

const DUMMY_DISTRIBUTOR_INCENTIVE_TREND: DistributorReportIncentiveTrendPoint[] = [
  { month: "Feb", earned: 1_68_400, paid: 1_65_200 },
  { month: "Mar", earned: 1_82_600, paid: 1_80_100 },
  { month: "Apr", earned: 1_74_800, paid: 1_74_800 },
  { month: "May", earned: 1_96_200, paid: 1_92_400 },
  { month: "Jun", earned: 2_08_600, paid: 2_05_800 },
  { month: "Jul", earned: 1_84_500, paid: 1_62_200 },
];

const DUMMY_DISTRIBUTOR_INCENTIVE_CATEGORIES: DistributorReportIncentiveCategoryRow[] = [
  { id: "equity", label: "Equity & hybrid", amount: 72_000, sharePct: 39 },
  { id: "elss", label: "ELSS / tax saver", amount: 42_500, sharePct: 23 },
  { id: "debt", label: "Debt & arbitrage", amount: 28_400, sharePct: 15 },
  { id: "liquid", label: "Liquid & overnight", amount: 18_200, sharePct: 10 },
  { id: "other", label: "Others", amount: 23_400, sharePct: 13 },
];

const INCENTIVE_MTD_EARNED = 1_84_500;
const INCENTIVE_MTD_RELEASED = 1_62_200;
const INCENTIVE_MTD_ON_HOLD = 22_300;

export const DUMMY_DISTRIBUTOR_REPORT_BOOK_COMPOSITION: DistributorReportBookCompositionRow[] = [
  { id: "equity", label: "Equity & hybrid", amount: 1_82_00_000, sharePct: 42 },
  { id: "debt", label: "Debt & arbitrage", amount: 98_50_000, sharePct: 23 },
  { id: "elss", label: "ELSS / tax saver", amount: 74_20_000, sharePct: 17 },
  { id: "liquid", label: "Liquid & overnight", amount: 48_30_000, sharePct: 11 },
  { id: "other", label: "Others", amount: 32_50_000, sharePct: 7 },
];

export const DUMMY_DISTRIBUTOR_REPORT_AUM_MOVEMENT: DistributorReportAumMovementRow[] = [
  { id: "opening", label: "Opening", amount: 4_28_00_000 },
  { id: "sip", label: "SIP inflow", amount: 42_00_000 },
  { id: "lumpsum", label: "Lumpsum", amount: 18_00_000 },
  { id: "redemptions", label: "Redemptions", amount: -8_20_000 },
  { id: "market", label: "Market", amount: 8_50_000 },
  { id: "closing", label: "Closing", amount: 4_35_50_000 },
];

export const DUMMY_DISTRIBUTOR_REPORT_SIP_TREND: DistributorReportSipTrendPoint[] = [
  { month: "Feb", inflow: 32_50_000, activeSips: 284 },
  { month: "Mar", inflow: 34_10_000, activeSips: 291 },
  { month: "Apr", inflow: 33_80_000, activeSips: 296 },
  { month: "May", inflow: 36_20_000, activeSips: 302 },
  { month: "Jun", inflow: 39_40_000, activeSips: 308 },
  { month: "Jul", inflow: 42_00_000, activeSips: 314 },
];

export function getDistributorReportIncentiveTrend(): DistributorReportIncentiveTrendPoint[] {
  return DUMMY_DISTRIBUTOR_INCENTIVE_TREND;
}

export function getDistributorReportIncentiveCategories(): DistributorReportIncentiveCategoryRow[] {
  return DUMMY_DISTRIBUTOR_INCENTIVE_CATEGORIES;
}

export const DUMMY_DISTRIBUTOR_REPORT_TEMPLATES: DistributorReportTemplate[] = [
  {
    id: "rt-sip",
    name: "SIP book",
    description: "Active SIPs, instalment amounts, and upcoming debit dates.",
    category: "Book",
    formats: ["PDF", "Excel"],
  },
  {
    id: "rt-redemptions",
    name: "Redemptions",
    description: "Redemption requests and settled outflows for the selected period.",
    category: "Book",
    formats: ["PDF", "Excel"],
  },
  {
    id: "rt-growth",
    name: "Client growth",
    description: ZYND_MITRA_COPY.onboardingsYourBook,
    category: "Growth",
    formats: ["PDF", "Excel"],
  },
  {
    id: "rt-incentive",
    name: "Incentive statement",
    description: "Earned, cleared, and paid incentives with category split.",
    category: "Incentives",
    formats: ["PDF", "Excel"],
  },
  {
    id: "rt-compliance",
    name: "Compliance digest",
    description: ZYND_MITRA_COPY.kycFollowUpDesc,
    category: "Compliance",
    formats: ["PDF", "Excel"],
  },
];

export const DUMMY_DISTRIBUTOR_REPORT_EXPORTS: DistributorReportExportRow[] = [
  {
    id: "exp-1",
    reportName: "AUM book",
    format: "Excel",
    generatedAt: "2026-07-27T06:30:00.000Z",
    periodLabel: "Jul 2026 · MTD",
    fileSizeLabel: "842 KB",
  },
  {
    id: "exp-2",
    reportName: "Commission statement",
    format: "PDF",
    generatedAt: "2026-07-25T18:00:00.000Z",
    periodLabel: "Jun 2026",
    fileSizeLabel: "214 KB",
  },
  {
    id: "exp-3",
    reportName: "SIP book",
    format: "CSV",
    generatedAt: "2026-07-22T09:15:00.000Z",
    periodLabel: "Jul 2026 · MTD",
    fileSizeLabel: "128 KB",
  },
  {
    id: "exp-4",
    reportName: "Client growth",
    format: "PDF",
    generatedAt: "2026-07-01T07:00:00.000Z",
    periodLabel: "Jun 2026",
    fileSizeLabel: "356 KB",
  },
  {
    id: "exp-5",
    reportName: "Redemptions",
    format: "PDF",
    generatedAt: "2026-06-18T11:20:00.000Z",
    periodLabel: "Jun 2026",
    fileSizeLabel: "192 KB",
  },
  {
    id: "exp-6",
    reportName: "Compliance digest",
    format: "CSV",
    generatedAt: "2026-06-05T08:45:00.000Z",
    periodLabel: "May 2026",
    fileSizeLabel: "96 KB",
  },
  {
    id: "exp-7",
    reportName: "Commission statement",
    format: "Excel",
    generatedAt: "2025-12-15T16:00:00.000Z",
    periodLabel: "Dec 2025",
    fileSizeLabel: "228 KB",
  },
  {
    id: "exp-8",
    reportName: "AUM book",
    format: "PDF",
    generatedAt: "2025-03-22T09:30:00.000Z",
    periodLabel: "Mar 2025 · FY",
    fileSizeLabel: "1.1 MB",
  },
];

export const DUMMY_DISTRIBUTOR_NET_SALES_TREND: DistributorNetSalesTrendPoint[] = [
  { month: "Aug", netSales: 22_40_000 },
  { month: "Sep", netSales: 26_80_000 },
  { month: "Oct", netSales: 24_10_000 },
  { month: "Nov", netSales: 29_50_000 },
  { month: "Dec", netSales: 31_20_000 },
  { month: "Jan", netSales: 27_60_000 },
  { month: "Feb", netSales: 28_00_000 },
  { month: "Mar", netSales: 32_50_000 },
  { month: "Apr", netSales: 24_20_000 },
  { month: "May", netSales: 38_00_000 },
  { month: "Jun", netSales: 42_00_000 },
  { month: "Jul", netSales: 45_50_000 },
];

function formatNetSalesTrendLabel(date: Date, compact: boolean): string {
  const month = date.toLocaleDateString("en-IN", { month: "short" });
  if (!compact) return month;
  const year = date.toLocaleDateString("en-IN", { year: "2-digit" });
  return `${month} '${year}`;
}

function buildDistributorNetSalesTrendFull(): DistributorNetSalesTrendPoint[] {
  const points: DistributorNetSalesTrendPoint[] = [];
  const start = new Date(2016, 7, 1);
  let netSales = 18_00_000;

  for (let index = 0; index < 120; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const wave = Math.sin(index / 2.8) * 0.06 + Math.cos(index / 5.5) * 0.04;
    netSales = Math.round(netSales * (1.012 + wave));

    if (index === 118) netSales = 42_00_000;
    if (index === 119) netSales = 45_50_000;

    points.push({
      month: formatNetSalesTrendLabel(date, false),
      netSales,
    });
  }

  return points;
}

let cachedNetSalesTrendFull: DistributorNetSalesTrendPoint[] | null = null;

export function getDistributorNetSalesTrendFull(): DistributorNetSalesTrendPoint[] {
  if (!cachedNetSalesTrendFull) {
    cachedNetSalesTrendFull = buildDistributorNetSalesTrendFull();
  }
  return cachedNetSalesTrendFull;
}

export function getDistributorNetSalesTrendForPeriod(
  period: DistributorNetSalesChartPeriod,
): DistributorNetSalesTrendPoint[] {
  const full = getDistributorNetSalesTrendFull();
  const count = NET_SALES_PERIOD_POINT_COUNT[period];
  const slice = full.slice(-count);
  const compactLabels = count > 12;
  const startIndex = full.length - slice.length;

  return slice.map((point, offset) => {
    const date = new Date(2016, 7 + startIndex + offset, 1);
    return {
      month: formatNetSalesTrendLabel(date, compactLabels),
      netSales: point.netSales,
    };
  });
}

export function distributorNetSalesChartPeriodLabel(period: DistributorNetSalesChartPeriod): string {
  return period;
}

export const DUMMY_DISTRIBUTOR_BOOK_TREND: DistributorBookTrendPoint[] = [
  { month: "Feb", aum: 3_82_00_000, netSales: 28_00_000, clientCount: 112 },
  { month: "Mar", aum: 3_95_00_000, netSales: 32_50_000, clientCount: 114 },
  { month: "Apr", aum: 4_02_00_000, netSales: 24_20_000, clientCount: 115 },
  { month: "May", aum: 4_18_00_000, netSales: 38_00_000, clientCount: 117 },
  { month: "Jun", aum: 4_28_00_000, netSales: 42_00_000, clientCount: 118 },
  { month: "Jul", aum: 4_35_50_000, netSales: 45_50_000, clientCount: 120 },
];

export function getDistributorNetSalesHyperCardData(): DistributorNetSalesHyperCardData {
  const summary = getDistributorReportSummary();
  const previous = DUMMY_DISTRIBUTOR_BOOK_TREND.at(-2);
  const changePct =
    previous && previous.netSales > 0
      ? ((summary.netSalesMtd - previous.netSales) / previous.netSales) * 100
      : 0;

  return {
    label: "Net sales MTD",
    currentAmount: summary.netSalesMtd,
    previousAmount: previous?.netSales ?? 0,
    changePct,
    sipInflowMtd: summary.sipInflowMtd,
    redemptionsMtd: summary.redemptionsMtd,
    periodYear: "2026",
    periodMonth: "Jul",
  };
}

export function getDistributorReportSummary() {
  const latest = DUMMY_DISTRIBUTOR_BOOK_TREND.at(-1);
  const previous = DUMMY_DISTRIBUTOR_BOOK_TREND.at(-2);
  const bookAum = latest?.aum ?? 0;
  const netSalesMtd = latest?.netSales ?? 0;
  const clientCount = latest?.clientCount ?? 0;
  const aumChangePct =
    previous && latest && previous.aum > 0
      ? ((latest.aum - previous.aum) / previous.aum) * 100
      : 0;
  const commissionTotals = {
    accrued: INCENTIVE_MTD_EARNED,
    released: INCENTIVE_MTD_RELEASED,
    onHold: INCENTIVE_MTD_ON_HOLD,
  };

  return {
    bookAum,
    netSalesMtd,
    clientCount,
    incomeMtd: commissionTotals.accrued,
    incomeReleasedMtd: commissionTotals.released,
    incomeOnHoldMtd: commissionTotals.onHold,
    templates: DUMMY_DISTRIBUTOR_REPORT_TEMPLATES.length,
    sipInflowMtd: 42_00_000,
    redemptionsMtd: 8_20_000,
    activeClients: clientCount - 2,
    onboardingClients: 2,
    bookTemplates: DUMMY_DISTRIBUTOR_REPORT_TEMPLATES.filter((row) => row.category === "Book").length,
    incentiveTemplates: DUMMY_DISTRIBUTOR_REPORT_TEMPLATES.filter(
      (row) => row.category === "Incentives",
    ).length,
    aumChangePct,
  };
}
