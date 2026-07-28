"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <Select
      value={selectValue}
      onValueChange={(next) =>
        onValueChange((next === ALL_OPTION_VALUE ? "all" : next) as T | "all")
      }
    >
      <SelectTrigger size="sm" className="min-w-[9rem] bg-background">
        <SelectValue placeholder={label}>
          {value === "all"
            ? label
            : options.find((option) => option.value === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_OPTION_VALUE}>All</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
