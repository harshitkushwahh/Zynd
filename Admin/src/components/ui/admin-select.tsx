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
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
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
  disabled = false,
  open,
  onOpenChange,
  modal = false,
  "aria-label": ariaLabel,
}: AdminSelectProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const controlledOpenProps =
    open !== undefined
      ? {
          open,
          onOpenChange: (next: boolean) => {
            onOpenChange?.(next);
          },
        }
      : {};

  return (
    <Select
      value={value}
      modal={modal}
      {...controlledOpenProps}
      onValueChange={(next) => {
        if (next != null) onValueChange(next);
      }}
    >
      <SelectTrigger
        size={size}
        disabled={disabled}
        className={cn(className, triggerClassName ?? "w-full")}
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
