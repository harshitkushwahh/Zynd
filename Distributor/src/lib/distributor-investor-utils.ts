import type { DistributorInvestor, InvestorType } from "@/lib/distributor-types";

export const DUMMY_INVESTORS: DistributorInvestor[] = [];

export function filterInvestorsByType(
  investors: DistributorInvestor[],
  investorType?: InvestorType,
): DistributorInvestor[] {
  if (!investorType) return investors;
  return investors.filter((investor) => investor.investorType === investorType);
}

export function filterDistributorBookInvestors(investors: DistributorInvestor[]): DistributorInvestor[] {
  return investors.filter((investor) => investor.inDistributorBook);
}

export function filterSystemResidentInvestors(investors: DistributorInvestor[]): DistributorInvestor[] {
  return filterInvestorsByType(investors, "Resident Individual");
}

export function searchInvestors(investors: DistributorInvestor[], query: string): DistributorInvestor[] {
  const q = query.trim().toLowerCase();
  if (!q) return investors;
  return investors.filter(
    (investor) =>
      investor.emailMasked.toLowerCase().includes(q) ||
      investor.panMasked.toLowerCase().includes(q) ||
      investor.clientCode.toLowerCase().includes(q) ||
      investor.mobileMasked.toLowerCase().includes(q),
  );
}
