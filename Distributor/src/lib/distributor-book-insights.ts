import {
  getPortfolioChartSeries,
  type PortfolioChartPoint,
} from "@/lib/client-portfolio-chart-data";
import {
  DUMMY_INVESTORS,
  filterDistributorBookInvestors,
  filterSystemResidentInvestors,
} from "@/lib/dummy/investors";
import type { DistributorInvestor } from "@/lib/dummy/types";

export type DistributorBookInsights = {
  bookAum: number;
  systemAum: number;
  bookClientCount: number;
  systemClientCount: number;
  onboardedCount: number;
  aumChangePct: number;
  bookClientSharePct: number;
  platformClientSharePct: number;
  aumSeries: PortfolioChartPoint[];
};

function sumBookAum(investors: DistributorInvestor[]): number {
  return filterDistributorBookInvestors(investors).reduce((sum, row) => sum + (row.aum ?? 0), 0);
}

function sumSystemAum(investors: DistributorInvestor[]): number {
  return filterSystemResidentInvestors(investors).reduce((sum, row) => sum + (row.aum ?? 0), 0);
}

function buildWeeklyBookAumSeries(investors: DistributorInvestor[]): PortfolioChartPoint[] {
  const book = filterDistributorBookInvestors(investors).filter((row) => (row.aum ?? 0) > 0);
  if (book.length === 0) return [];

  const seriesList = book.map((row) =>
    getPortfolioChartSeries(row.id, row.aum ?? 0, "6M"),
  );
  const pointCount = seriesList[0]?.length ?? 0;
  const labels = seriesList[0]?.map((point) => point.label) ?? [];

  return Array.from({ length: pointCount }, (_, index) => ({
    label: labels[index] ?? "",
    value: seriesList.reduce((sum, series) => sum + (series[index]?.value ?? 0), 0),
  }));
}

export function getDistributorBookInsights(
  investors: DistributorInvestor[] = DUMMY_INVESTORS,
): DistributorBookInsights {
  const bookClients = filterDistributorBookInvestors(investors);
  const systemClients = filterSystemResidentInvestors(investors);
  const bookAum = sumBookAum(investors);
  const systemAum = sumSystemAum(investors);
  const onboardedCount = bookClients.filter((row) => row.onboardingStatus === "Onboarded").length;

  const aumSeries = buildWeeklyBookAumSeries(investors);
  const firstTotal = aumSeries[0]?.value ?? bookAum;
  const lastTotal = aumSeries[aumSeries.length - 1]?.value ?? bookAum;
  const aumChangePct =
    firstTotal > 0 ? ((lastTotal - firstTotal) / firstTotal) * 100 : 0;

  const bookClientSharePct =
    systemClients.length > 0 ? (bookClients.length / systemClients.length) * 100 : 0;
  const platformClientSharePct = Math.max(0, 100 - bookClientSharePct);

  return {
    bookAum,
    systemAum,
    bookClientCount: bookClients.length,
    systemClientCount: systemClients.length,
    onboardedCount,
    aumChangePct,
    bookClientSharePct,
    platformClientSharePct,
    aumSeries,
  };
}

export function formatInsightChangePct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
