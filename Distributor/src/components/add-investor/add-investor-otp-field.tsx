"use client";

import { useRef } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AddInvestorOtpFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  length?: number;
};

export function AddInvestorOtpField({
  id,
  value,
  onChange,
  disabled,
  length = 6,
}: AddInvestorOtpFieldProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  const commitDigits = (nextDigits: string[]) => {
    onChange(nextDigits.join("").replace(/\s/g, "").slice(0, length));
  };

  return (
    <div className="add-investor-otp" role="group" aria-label="One-time password">
      {digits.map((digit, index) => (
        <Input
          key={`${id}-${index}`}
          id={index === 0 ? id : undefined}
          ref={(node) => {
            inputsRef.current[index] = node;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digit.trim()}
          className={cn("add-investor-otp__cell", digit.trim() && "add-investor-otp__cell--filled")}
          aria-label={`Digit ${index + 1} of ${length}`}
          onChange={(event) => {
            const nextChar = event.target.value.replace(/\D/g, "").slice(-1);
            const next = [...digits.map((d) => d.trim())];
            next[index] = nextChar;
            commitDigits(next);
            if (nextChar && index < length - 1) {
              inputsRef.current[index + 1]?.focus();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index]?.trim() && index > 0) {
              inputsRef.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (!pasted) return;
            onChange(pasted);
            const focusIndex = Math.min(pasted.length, length - 1);
            inputsRef.current[focusIndex]?.focus();
          }}
        />
      ))}
    </div>
  );
}
