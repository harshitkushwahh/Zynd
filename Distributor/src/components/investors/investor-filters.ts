import type {
  DistributorInvestor,
  InvestorComplianceStatus,
  InvestorInvestmentStatus,
  InvestorOnboardingStatus,
  InvestorServiceModel,
  InvestorType,
} from "@/lib/dummy/types";

export type InvestorTableFilters = {
  search: string;
  onboarding: "all" | InvestorOnboardingStatus;
  compliance: "all" | InvestorComplianceStatus;
  investment: "all" | InvestorInvestmentStatus;
  investorType: "all" | InvestorType;
  serviceModel: "all" | InvestorServiceModel;
};

export const DEFAULT_INVESTOR_TABLE_FILTERS: InvestorTableFilters = {
  search: "",
  onboarding: "all",
  compliance: "all",
  investment: "all",
  investorType: "all",
  serviceModel: "all",
};

export function applyInvestorTableFilters(
  investors: readonly DistributorInvestor[],
  filters: InvestorTableFilters,
): DistributorInvestor[] {
  const query = filters.search.trim().toLowerCase();

  return investors.filter((investor) => {
    if (query) {
      const haystack = [
        investor.clientCode,
        investor.emailMasked,
        investor.panMasked,
        investor.mobileMasked,
        investor.investorType,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
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
    if (filters.serviceModel !== "all") {
      const model = investor.serviceModel ?? "diy";
      if (model !== filters.serviceModel) return false;
    }
    return true;
  });
}

export function investorFiltersAreDefault(filters: InvestorTableFilters): boolean {
  return (
    filters.search.trim() === "" &&
    filters.onboarding === DEFAULT_INVESTOR_TABLE_FILTERS.onboarding &&
    filters.compliance === DEFAULT_INVESTOR_TABLE_FILTERS.compliance &&
    filters.investment === DEFAULT_INVESTOR_TABLE_FILTERS.investment &&
    filters.investorType === DEFAULT_INVESTOR_TABLE_FILTERS.investorType &&
    filters.serviceModel === DEFAULT_INVESTOR_TABLE_FILTERS.serviceModel
  );
}
