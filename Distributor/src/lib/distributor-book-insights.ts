import type { PortfolioChartPoint } from "@/lib/client-portfolio-chart-data";
import {
  filterDistributorBookInvestors,
  filterSystemResidentInvestors,
} from "@/lib/distributor-investor-utils";
import type { DistributorInvestor } from "@/lib/distributor-types";

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

export function getDistributorBookInsights(
  investors: DistributorInvestor[] = [],
): DistributorBookInsights {
  const book = filterDistributorBookInvestors(investors);
  const platform = filterSystemResidentInvestors(investors);
  const bookAum = book.reduce((sum, row) => sum + (row.aum ?? 0), 0);
  const systemAum = platform.reduce((sum, row) => sum + (row.aum ?? 0), 0);

  return {
    bookAum,
    systemAum,
    bookClientCount: book.length,
    systemClientCount: platform.length,
    onboardedCount: book.filter((row) => row.onboardingStatus === "Onboarded").length,
    aumChangePct: 0,
    bookClientSharePct: platform.length ? Math.round((book.length / platform.length) * 100) : 0,
    platformClientSharePct: platform.length ? 100 : 0,
    aumSeries: [],
  };
}
