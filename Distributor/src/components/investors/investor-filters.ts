import type {
  DistributorInvestor,
  InvestorComplianceStatus,
  InvestorInvestmentStatus,
  InvestorOnboardingStatus,
  InvestorType,
} from "@/lib/dummy/types";

export type InvestorTableFilters = {
  onboarding: "all" | InvestorOnboardingStatus;
  compliance: "all" | InvestorComplianceStatus;
  investment: "all" | InvestorInvestmentStatus;
  investorType: "all" | InvestorType;
};

export const DEFAULT_INVESTOR_TABLE_FILTERS: InvestorTableFilters = {
  onboarding: "all",
  compliance: "all",
  investment: "all",
  investorType: "all",
};

export function applyInvestorTableFilters(
  investors: readonly DistributorInvestor[],
  filters: InvestorTableFilters,
): DistributorInvestor[] {
  return investors.filter((investor) => {
    if (filters.onboarding !== "all" && investor.onboardingStatus !== filters.onboarding) {
      return false;
    }
    if (filters.compliance !== "all" && investor.complianceStatus !== filters.compliance) {
      return false;
    }
    if (filters.investment !== "all" && investor.investmentStatus !== filters.investment) {
      return false;
    }
    if (filters.investorType !== "all" && investor.investorType !== filters.investorType) {
      return false;
    }
    return true;
  });
}

export function investorFiltersAreDefault(filters: InvestorTableFilters): boolean {
  return (
    filters.onboarding === DEFAULT_INVESTOR_TABLE_FILTERS.onboarding &&
    filters.compliance === DEFAULT_INVESTOR_TABLE_FILTERS.compliance &&
    filters.investment === DEFAULT_INVESTOR_TABLE_FILTERS.investment &&
    filters.investorType === DEFAULT_INVESTOR_TABLE_FILTERS.investorType
  );
}
