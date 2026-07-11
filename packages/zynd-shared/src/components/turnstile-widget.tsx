"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef } from "react";

import { cn } from "../utils/cn";

export type TurnstileWidgetProps = {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  resetKey?: string | number;
  className?: string;
};

export function isTurnstileEnabled(siteKey: string | undefined | null) {
  return Boolean(siteKey);
}

export function TurnstileWidget({
  siteKey,
  onVerify,
  onExpire,
  resetKey,
  className,
}: TurnstileWidgetProps) {
  const ref = useRef<TurnstileInstance>(null);

  if (!siteKey) {
    return null;
  }

  return (
    <div className={cn("flex min-h-[65px] justify-center", className)}>
      <Turnstile
        key={resetKey}
        ref={ref}
        siteKey={siteKey}
        onSuccess={onVerify}
        onExpire={() => {
          onExpire?.();
          ref.current?.reset();
        }}
        options={{
          theme: "light",
          size: "flexible",
        }}
      />
    </div>
  );
}
