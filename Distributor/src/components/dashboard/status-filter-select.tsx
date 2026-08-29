"use client";

import {
  DistributorOptionBox,
  DistributorOptionBoxContent,
  DistributorOptionBoxItem,
  DistributorOptionBoxTrigger,
  DistributorOptionBoxValue,
} from "@/components/ui/distributor-option-box";

type StatusFilterSelectProps<T extends string> = {
  label: string;
  value: T | "all";
  options: Array<{ value: T; label: string }>;
  onValueChange: (value: T | "all") => void;
};

function statusFilterSelectLabel<T extends string>(
  value: T | "all",
  options: Array<{ value: T; label: string }>,
): string {
  if (value === "all") return "All";
  return options.find((option) => option.value === value)?.label ?? value;
}

export function StatusFilterSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: StatusFilterSelectProps<T>) {
  return (
    <DistributorOptionBox
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        onValueChange(next as T | "all");
      }}
    >
      <DistributorOptionBoxTrigger>
        <DistributorOptionBoxValue placeholder={label}>
          {statusFilterSelectLabel(value, options)}
        </DistributorOptionBoxValue>
      </DistributorOptionBoxTrigger>
      <DistributorOptionBoxContent>
        <DistributorOptionBoxItem value="all">All</DistributorOptionBoxItem>
        {options.map((option) => (
          <DistributorOptionBoxItem key={option.value} value={option.value}>
            {option.label}
          </DistributorOptionBoxItem>
        ))}
      </DistributorOptionBoxContent>
    </DistributorOptionBox>
  );
}
