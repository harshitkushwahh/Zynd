"use client";

import {
  DistributorOptionBox,
  DistributorOptionBoxContent,
  DistributorOptionBoxItem,
  DistributorOptionBoxTrigger,
  DistributorOptionBoxValue,
} from "@/components/ui/distributor-option-box";

const ALL_OPTION_VALUE = "__all__";

type StatusFilterSelectProps<T extends string> = {
  label: string;
  value: T | "all";
  options: Array<{ value: T; label: string }>;
  onValueChange: (value: T | "all") => void;
};

export function StatusFilterSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: StatusFilterSelectProps<T>) {
  const selectValue = value === "all" ? ALL_OPTION_VALUE : value;

  return (
    <DistributorOptionBox
      value={selectValue}
      onValueChange={(next) =>
        onValueChange((next === ALL_OPTION_VALUE ? "all" : next) as T | "all")
      }
    >
      <DistributorOptionBoxTrigger>
        <DistributorOptionBoxValue placeholder={label}>
          {value === "all"
            ? label
            : options.find((option) => option.value === value)?.label}
        </DistributorOptionBoxValue>
      </DistributorOptionBoxTrigger>
      <DistributorOptionBoxContent>
        <DistributorOptionBoxItem value={ALL_OPTION_VALUE}>All</DistributorOptionBoxItem>
        {options.map((option) => (
          <DistributorOptionBoxItem key={option.value} value={option.value}>
            {option.label}
          </DistributorOptionBoxItem>
        ))}
      </DistributorOptionBoxContent>
    </DistributorOptionBox>
  );
}
