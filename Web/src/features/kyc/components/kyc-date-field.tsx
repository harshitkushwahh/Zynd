"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatNomineeDobDisplay,
  formatNomineeDobForDateInput,
  formatNomineeDobInput,
  parseNomineeDob,
} from "@/features/kyc/lib/kyc-nominee";
import { copy } from "@/shared/config/copy";
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
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() =>
    parseNomineeDob(value) ? formatNomineeDobDisplay(value) : value,
  );

  useEffect(() => {
    if (!value) {
      setText("");
      return;
    }
    if (parseNomineeDob(value)) {
      setText(formatNomineeDobDisplay(value));
    }
  }, [value]);

  const emitValue = (next: string) => {
    const parsed = parseNomineeDob(next);
    onChange(parsed ? formatNomineeDobForDateInput(next) : next);
  };

  const openBrowserCalendar = () => {
    const input = pickerRef.current;
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
    input.click();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="bday"
          placeholder={copy.kyc.nominee.placeholders.dateOfBirth}
          value={text}
          maxLength={10}
          disabled={disabled}
          aria-invalid={hasError}
          onChange={(event) => {
            const formatted = formatNomineeDobInput(event.target.value);
            setText(formatted);
            emitValue(formatted);
          }}
          className="pr-10"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={openBrowserCalendar}
          className={cn(
            "absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-muted-foreground transition-colors",
            "hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
          )}
          aria-label={copy.kyc.nominee.openCalendar}
        >
          <CalendarDays className="size-4" strokeWidth={2} />
        </button>
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={formatNomineeDobForDateInput(value)}
          max={max}
          disabled={disabled}
          onChange={(event) => {
            const iso = event.target.value;
            setText(iso ? formatNomineeDobDisplay(iso) : "");
            onChange(iso);
          }}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      </div>
    </div>
  );
}
