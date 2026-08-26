
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

const DUMMY_DISTRIBUTOR_INCENTIVE_TREND: DistributorReportIncentiveTrendPoint[] = [];

const DUMMY_DISTRIBUTOR_INCENTIVE_CATEGORIES: DistributorReportIncentiveCategoryRow[] = [];

const INCENTIVE_MTD_EARNED = 0;
const INCENTIVE_MTD_RELEASED = 0;
const INCENTIVE_MTD_ON_HOLD = 0;

export const DUMMY_DISTRIBUTOR_REPORT_BOOK_COMPOSITION: DistributorReportBookCompositionRow[] = [];

export const DUMMY_DISTRIBUTOR_REPORT_AUM_MOVEMENT: DistributorReportAumMovementRow[] = [];

export const DUMMY_DISTRIBUTOR_REPORT_SIP_TREND: DistributorReportSipTrendPoint[] = [];

export function getDistributorReportIncentiveTrend(): DistributorReportIncentiveTrendPoint[] {
  return DUMMY_DISTRIBUTOR_INCENTIVE_TREND;
}

export function getDistributorReportIncentiveCategories(): DistributorReportIncentiveCategoryRow[] {
  return DUMMY_DISTRIBUTOR_INCENTIVE_CATEGORIES;
}

export const DUMMY_DISTRIBUTOR_REPORT_TEMPLATES: DistributorReportTemplate[] = [];

export const DUMMY_DISTRIBUTOR_REPORT_EXPORTS: DistributorReportExportRow[] = [];

export const DUMMY_DISTRIBUTOR_NET_SALES_TREND: DistributorNetSalesTrendPoint[] = [];

function formatNetSalesTrendLabel(date: Date, compact: boolean): string {
  const month = date.toLocaleDateString("en-IN", { month: "short" });
  if (!compact) return month;
  const year = date.toLocaleDateString("en-IN", { year: "2-digit" });
  return `${month} '${year}`;
}

function buildDistributorNetSalesTrendFull(): DistributorNetSalesTrendPoint[] {
  return [];
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

export const DUMMY_DISTRIBUTOR_BOOK_TREND: DistributorBookTrendPoint[] = [];

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
    sipInflowMtd: 0,
    redemptionsMtd: 0,
    activeClients: clientCount,
    onboardingClients: 0,
    bookTemplates: DUMMY_DISTRIBUTOR_REPORT_TEMPLATES.filter((row) => row.category === "Book").length,
    incentiveTemplates: DUMMY_DISTRIBUTOR_REPORT_TEMPLATES.filter(
      (row) => row.category === "Incentives",
    ).length,
    aumChangePct,
  };
}
