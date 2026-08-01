"use client";

import type { ReactNode } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type DistributorFeedbackMessageProps = {
  variant: "error" | "success";
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

export function DistributorFeedbackMessage({
  variant,
  children,
  onDismiss,
  className,
}: DistributorFeedbackMessageProps) {
  const StatusIcon = variant === "error" ? XCircle : CheckCircle2;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "distributor-feedback-message",
        variant === "error" && "distributor-feedback-message--error",
        variant === "success" && "distributor-feedback-message--success",
        className,
      )}
    >
      <StatusIcon className="distributor-feedback-message__icon" strokeWidth={2.25} aria-hidden />
      <div className="distributor-feedback-message__content">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          className="distributor-feedback-message__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <X className="size-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
