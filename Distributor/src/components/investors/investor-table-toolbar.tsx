"use client";

import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { InvestorTableFilters } from "@/components/investors/investor-filters";
import type {
  InvestorComplianceStatus,
  InvestorInvestmentStatus,
  InvestorOnboardingStatus,
  InvestorType,
} from "@/lib/dummy/types";

const ONBOARDING_OPTIONS: Array<{ value: InvestorOnboardingStatus; label: string }> = [
  { value: "Onboarded", label: "Onboarded" },
  { value: "Pending", label: "Pending" },
];

const COMPLIANCE_OPTIONS: Array<{ value: InvestorComplianceStatus; label: string }> = [
  { value: "Compliant", label: "Compliant" },
  { value: "Non Compliant", label: "Non compliant" },
];

const INVESTMENT_OPTIONS: Array<{ value: InvestorInvestmentStatus; label: string }> = [
  { value: "Invested", label: "Invested" },
  { value: "Non Invested", label: "Non invested" },
];

const TYPE_OPTIONS: Array<{ value: InvestorType; label: string }> = [
  { value: "Resident Individual", label: "Resident" },
  { value: "Non Resident Individual", label: "NRI" },
];

type InvestorTableToolbarProps = {
  filters: InvestorTableFilters;
  onChange: (filters: InvestorTableFilters) => void;
  onClearAll: () => void;
  clearDisabled: boolean;
  showTypeFilter: boolean;
};

export function InvestorTableToolbar({
  filters,
  onChange,
  onClearAll,
  clearDisabled,
  showTypeFilter,
}: InvestorTableToolbarProps) {
  return (
    <DistributorTableToolbar onClearAll={onClearAll} clearDisabled={clearDisabled}>
      <StatusFilterSelect
        label="Onboarding"
        value={filters.onboarding}
        options={ONBOARDING_OPTIONS}
        onValueChange={(onboarding) => onChange({ ...filters, onboarding })}
      />
      <StatusFilterSelect
        label="Compliance"
        value={filters.compliance}
        options={COMPLIANCE_OPTIONS}
        onValueChange={(compliance) => onChange({ ...filters, compliance })}
      />
      <StatusFilterSelect
        label="Investment"
        value={filters.investment}
        options={INVESTMENT_OPTIONS}
        onValueChange={(investment) => onChange({ ...filters, investment })}
      />
      {showTypeFilter ? (
        <StatusFilterSelect
          label="Investor type"
          value={filters.investorType}
          options={TYPE_OPTIONS}
          onValueChange={(investorType) => onChange({ ...filters, investorType })}
        />
      ) : null}
    </DistributorTableToolbar>
  );
}
