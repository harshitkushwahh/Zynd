"use client";

import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type KycSelectOption = string | { label: string; value: string };

type KycSelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: readonly KycSelectOption[];
  placeholder: string;
  disabled?: boolean;
  hasError?: boolean;
  required?: boolean;
  icon?: LucideIcon;
  triggerClassName?: string;
  infoTooltip?: string;
  onChange: (value: string) => void;
};

function normalizeOptions(options: readonly KycSelectOption[]) {
  return options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option,
  );
}

export function KycSelectField({
  id,
  label,
  value,
  options,
  placeholder,
  disabled,
  hasError,
  required = false,
  icon: Icon,
  triggerClassName,
  infoTooltip,
  onChange,
}: KycSelectFieldProps) {
  const normalizedOptions = normalizeOptions(options);
  const selectedLabel = normalizedOptions.find((option) => option.value === value)?.label;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="whitespace-nowrap">
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
        {infoTooltip ? (
          <Tooltip>
            <TooltipTrigger
              type="button"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`About ${label}`}
            >
              <Info className="size-3.5" strokeWidth={2.25} aria-hidden />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[16rem] text-pretty">
              {infoTooltip}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <Select
        value={value || null}
        onValueChange={(nextValue) => onChange(nextValue ?? "")}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className={triggerClassName ?? "w-full rounded-[var(--radius-control)] text-body"}
          aria-invalid={hasError}
        >
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden /> : null}
          <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {normalizedOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
