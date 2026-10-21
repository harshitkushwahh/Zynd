"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef, useState } from "react";

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [resetKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative isolate z-[2] flex min-h-[4.5rem] w-full items-center justify-center overflow-visible",
        className,
      )}
      aria-busy={!loaded}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-1/2 h-[3.25rem] -translate-y-1/2 rounded-[var(--radius-control,0.375rem)] bg-muted/25 transition-opacity duration-300",
          loaded ? "opacity-0" : "opacity-100",
        )}
        aria-hidden
      />
      <div className="relative z-10 w-full min-h-[4.5rem]">
        <Turnstile
          key={resetKey}
          ref={ref}
          siteKey={siteKey}
          onSuccess={onVerify}
          onLoad={() => setLoaded(true)}
          onExpire={() => {
            onExpire?.();
            setLoaded(false);
            ref.current?.reset();
          }}
          options={{
            theme: "auto",
            size: "flexible",
          }}
        />
      </div>
    </div>
  );
}
