"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { useAdminZyndPin } from "@/contexts/admin-zynd-pin-context";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { cn } from "@/lib/utils";

function PinInput({
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
            error && "border-destructive"
          )}
          onChange={(event) => updateDigit(index, event.target.value)}
        />
      ))}
    </div>
  );
}

export function AdminZyndPinLockScreen() {
  const { displayName } = useAdminAuth();
  const { unlock, unlockError, clearUnlockError } = useAdminZyndPin();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const submitPin = useCallback(
    async (pinValue: string) => {
      if (pinValue.length !== 4 || submittingRef.current) return;

      submittingRef.current = true;
      setLoading(true);
      clearUnlockError();
      try {
        await unlock(pinValue);
        setPin("");
      } catch {
        setPin("");
      } finally {
        submittingRef.current = false;
        setLoading(false);
      }
    },
    [clearUnlockError, unlock]
  );

  useEffect(() => {
    if (pin.length !== 4) return;
    void submitPin(pin);
  }, [pin, submitPin]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[var(--radius-3xl)] border border-border bg-card p-6">
        <div className="mb-5 flex flex-col items-center text-center">
          <Image
            src="/zynda.png"
            alt="ZYND"
            width={40}
            height={40}
            className="mb-3 size-10 object-contain object-center"
            priority
          />
          <h1 className="text-h4 font-semibold text-foreground">Enter your Zynd PIN</h1>
          <p className="mt-1 text-caption text-muted-foreground">
            {displayName ? `Unlock the admin console, ${displayName}.` : "Unlock the admin console."}
          </p>
        </div>
        <div className={cn("transition-opacity duration-200", loading && "pointer-events-none opacity-60")}>
          <PinInput
            value={pin}
            onChange={(value) => {
              setPin(value);
              if (unlockError) clearUnlockError();
            }}
            error={!!unlockError}
          />
        </div>
        {loading ? (
          <p className="mt-3 text-center text-caption text-muted-foreground">Verifying...</p>
        ) : null}
        {unlockError ? (
          <p className="mt-3 text-center text-caption text-destructive">{unlockError}</p>
        ) : null}
      </div>
    </div>
  );
}
