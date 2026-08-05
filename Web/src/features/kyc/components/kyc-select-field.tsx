"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type KycSelectOption = string | { label: string; value: string };

type KycSelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: readonly KycSelectOption[];
  placeholder: string;
  disabled?: boolean;
  hasError?: boolean;
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
  onChange,
}: KycSelectFieldProps) {
  const normalizedOptions = normalizeOptions(options);
  const selectedLabel = normalizedOptions.find((option) => option.value === value)?.label;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || null}
        onValueChange={(nextValue) => onChange(nextValue ?? "")}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className="w-full rounded-[var(--radius-control)] text-body"
          aria-invalid={hasError}
        >
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
