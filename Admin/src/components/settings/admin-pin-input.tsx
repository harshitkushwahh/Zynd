"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

export function AdminPinInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(4, " ").split("").slice(0, 4);

  const updateDigit = (index: number, digit: string) => {
    const cleaned = digit.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[index] = cleaned;
    onChange(next.join("").replace(/\s/g, "").slice(0, 4));
    if (cleaned && index < 3) inputsRef.current[index + 1]?.focus();
  };

  return (
    <div className="flex justify-center gap-2.5">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit.trim()}
          aria-invalid={error}
          className={cn(
            "size-11 rounded-[var(--radius-control)] border border-input bg-background text-center text-h4 font-semibold shadow-zynd-low outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20",
            error && "border-destructive",
          )}
          onChange={(event) => updateDigit(index, event.target.value)}
        />
      ))}
    </div>
  );
}
