"use client";

import { useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNomineeDobForDateInput, parseNomineeDob } from "@/features/kyc/lib/kyc-nominee";
import { cn } from "@/lib/utils";

type KycDateFieldProps = {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  hasError?: boolean;
  max?: string;
  onChange: (value: string) => void;
};

export function KycDateField({
  id,
  label,
  value,
  disabled,
  hasError,
  max,
  onChange,
}: KycDateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const isoValue = formatNomineeDobForDateInput(value) || (parseNomineeDob(value) ? value : "");

  const openBrowserCalendar = () => {
    const input = inputRef.current;
    if (!input || disabled) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // showPicker can throw if not triggered by a user gesture in some browsers.
      }
    }

    input.focus();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={inputRef}
        id={id}
        type="date"
        value={isoValue}
        max={max}
        disabled={disabled}
        aria-invalid={hasError}
        onClick={openBrowserCalendar}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "cursor-pointer",
          "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
        )}
      />
    </div>
  );
}
