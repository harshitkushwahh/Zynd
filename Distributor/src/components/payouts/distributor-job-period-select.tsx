"use client";

import {
  DistributorOptionBox,
  DistributorOptionBoxContent,
  DistributorOptionBoxItem,
  DistributorOptionBoxTrigger,
  DistributorOptionBoxValue,
} from "@/components/ui/distributor-option-box";
import { CURRENT_PAYROLL_ID, DUMMY_DISTRIBUTOR_SALARY_SLIPS } from "@/lib/dummy/distributor-job-dashboard";

const JOB_PERIOD_OPTIONS = DUMMY_DISTRIBUTOR_SALARY_SLIPS.map((row) => ({
  value: row.payrollId,
  label: row.periodLabel,
}));

type DistributorJobPeriodSelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
};

export function DistributorJobPeriodSelect({
  value = CURRENT_PAYROLL_ID,
  onValueChange,
}: DistributorJobPeriodSelectProps) {
  const selectedLabel = JOB_PERIOD_OPTIONS.find((option) => option.value === value)?.label;

  return (
    <DistributorOptionBox value={value} onValueChange={onValueChange}>
      <DistributorOptionBoxTrigger aria-label="Payroll period">
        <DistributorOptionBoxValue placeholder="Period">{selectedLabel}</DistributorOptionBoxValue>
      </DistributorOptionBoxTrigger>
      <DistributorOptionBoxContent align="end">
        {JOB_PERIOD_OPTIONS.map((option) => (
          <DistributorOptionBoxItem key={option.value} value={option.value}>
            {option.label}
          </DistributorOptionBoxItem>
        ))}
      </DistributorOptionBoxContent>
    </DistributorOptionBox>
  );
}
