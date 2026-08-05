"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AdminSelectOption = {
  value: string;
  label: string;
};

type AdminSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly AdminSelectOption[];
  placeholder?: string;
  size?: "sm" | "default";
  className?: string;
  triggerClassName?: string;
  contentAlign?: "start" | "center" | "end";
  "aria-label"?: string;
};

export function AdminSelect({
  value,
  onValueChange,
  options,
  placeholder,
  size = "sm",
  className,
  triggerClassName,
  contentAlign = "start",
  "aria-label": ariaLabel,
}: AdminSelectProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next != null) onValueChange(next);
      }}
    >
      <SelectTrigger
        size={size}
        className={cn(className, triggerClassName)}
        aria-label={ariaLabel ?? placeholder}
      >
        <SelectValue placeholder={placeholder}>
          {selectedLabel ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align={contentAlign}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
