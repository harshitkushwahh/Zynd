"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

export function OtpInput({
  id,
  value,
  onChange,
  error = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  const updateDigit = (index: number, digit: string) => {
    const cleaned = digit.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[index] = cleaned;
    const joined = next.join("").replace(/\s/g, "").slice(0, 6);
    onChange(joined);

    if (cleaned && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const form = event.currentTarget.form;
      if (form) {
        const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]:not([disabled])');
        if (submitButton) {
          form.requestSubmit(submitButton);
        }
      }
      return;
    }

    if (event.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    onChange(pasted);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          id={index === 0 ? id : undefined}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit.trim()}
          aria-invalid={error}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          className={cn(
            "h-11 w-full rounded-[var(--radius-control)] border border-input bg-muted/20 text-center text-body font-medium text-foreground outline-none transition-all focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30",
            error && "border-destructive focus-visible:ring-destructive/20"
          )}
        />
      ))}
    </div>
  );
}
