"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type MfPaymentProgressBarProps = {
  active?: boolean;
  className?: string;
  label?: string;
  variant?: "pulse" | "indeterminate";
};

export function MfPaymentProgressBar({
  active = true,
  className,
  label = "Processing",
  variant = "pulse",
}: MfPaymentProgressBarProps) {
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    if (!active || variant !== "pulse") return;

    let direction = 1;
    let value = 12;
    const timer = window.setInterval(() => {
      value += direction * 3;
      if (value >= 88) direction = -1;
      if (value <= 12) direction = 1;
      setProgress(value);
    }, 90);

    return () => window.clearInterval(timer);
  }, [active, variant]);

  if (variant === "indeterminate") {
    return (
      <div className={cn("w-full", className)}>
        <div
          className="relative h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={label}
          aria-busy="true"
        >
          <div className="absolute inset-y-0 w-2/5 animate-[mf-payment-indeterminate_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
