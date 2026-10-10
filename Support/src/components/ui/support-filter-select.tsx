"use client";

import {
  SupportSelect,
  SupportSelectContent,
  SupportSelectItem,
  SupportSelectTrigger,
  SupportSelectValue,
  SUPPORT_SELECT_CONTENT_CLASS,
} from "@/components/ui/support-select";
import { cn } from "@/lib/utils";

export type SupportFilterSelectProps<T extends string> = {
  label: string;
  value: T | "all";
  options: Array<{ value: T; label: string }>;
  onValueChange: (value: T | "all") => void;
  /** @default true */
  showAllOption?: boolean;
  className?: string;
  triggerClassName?: string;
};

function filterSelectLabel<T extends string>(
  value: T | "all",
  options: Array<{ value: T; label: string }>,
): string {
  if (value === "all") return "All";
  return options.find((option) => option.value === value)?.label ?? value;
}

export function SupportFilterSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
  showAllOption = true,
  className,
  triggerClassName,
}: SupportFilterSelectProps<T>) {
  return (
    <SupportSelect<T | "all">
      value={value}
      onValueChange={(next) => {
        if (next == null) return;
        onValueChange(next);
      }}
    >
      <SupportSelectTrigger className={cn(className, triggerClassName)}>
        <SupportSelectValue placeholder={label}>{filterSelectLabel(value, options)}</SupportSelectValue>
      </SupportSelectTrigger>
      <SupportSelectContent className={SUPPORT_SELECT_CONTENT_CLASS}>
        {showAllOption ? <SupportSelectItem value="all">All</SupportSelectItem> : null}
        {options.map((option) => (
          <SupportSelectItem key={option.value} value={option.value}>
            {option.label}
          </SupportSelectItem>
        ))}
      </SupportSelectContent>
    </SupportSelect>
  );
}
