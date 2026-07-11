"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type KycMobileFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  onChange: (value: string) => void;
};

export function KycMobileField({
  id,
  label,
  value,
  placeholder,
  disabled,
  hasError,
  onChange,
}: KycMobileFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex">
        <span
          className={cn(
            "inline-flex h-8 shrink-0 items-center rounded-l-[var(--radius-control)] border border-r-0 border-input bg-muted/50 px-2.5 text-caption font-medium text-muted-foreground",
            hasError && "border-destructive",
          )}
        >
          IND
        </span>
        <Input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={hasError}
          className="rounded-l-none"
        />
      </div>
    </div>
  );
}
