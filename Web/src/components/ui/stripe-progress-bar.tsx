"use client";

import { cn } from "@/lib/utils";

type StripeProgressBarProps = {
  className?: string;
  label?: string;
};

export function StripeProgressBar({ className, label = "Loading" }: StripeProgressBarProps) {
  return (
    <div
      className={cn("stripe-progress-bar", className)}
      role="progressbar"
      aria-label={label}
      aria-busy="true"
    >
      <div className="stripe-progress-bar__track" />
    </div>
  );
}
