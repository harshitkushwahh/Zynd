"use client";

import { useRef } from "react";

import { appConfig } from "@/shared/config/app-config";
import { cn } from "@/lib/utils";

type PinInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  id?: string;
  autoFocus?: boolean;
  compact?: boolean;
  disabled?: boolean;
  success?: boolean;
};

export function PinInput({
  value,
  onChange,
  error,
  id,
  autoFocus,
  compact = false,
  disabled = false,
  success = false,
}: PinInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const length = appConfig.pinLength;
  const digits = value.padEnd(length, " ").split("").slice(0, length);

  const updateDigit = (index: number, digit: string) => {
    const cleaned = digit.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[index] = cleaned;
    onChange(next.join("").replace(/\s/g, "").slice(0, length));

    if (cleaned && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div
      id={id}
      className={cn("flex justify-center", compact ? "gap-2" : "gap-2.5")}
      onPaste={handlePaste}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="password"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0 && !disabled}
          disabled={disabled}
          maxLength={1}
          value={digit.trim()}
          aria-invalid={error}
          className={cn(
            "rounded-[var(--radius-control)] border border-input bg-muted/20 text-center font-semibold outline-none transition-all focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30",
            compact ? "size-10 text-compact" : "size-11 text-h4 bg-background",
            !compact && !disabled && "shadow-zynd-low",
            disabled && "cursor-not-allowed opacity-45",
            error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
            success && !error && "border-success/50 bg-success/5 focus-visible:border-success focus-visible:ring-success/20"
          )}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
        />
      ))}
    </div>
  );
}
