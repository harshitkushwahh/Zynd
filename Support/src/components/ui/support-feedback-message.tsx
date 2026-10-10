"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type SupportFeedbackMessageProps = {
  variant: "error" | "success" | "warning";
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

export function SupportFeedbackMessage({
  variant,
  children,
  onDismiss,
  className,
}: SupportFeedbackMessageProps) {
  const StatusIcon =
    variant === "error" ? XCircle : variant === "warning" ? AlertTriangle : CheckCircle2;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "support-feedback-message",
        variant === "error" && "support-feedback-message--error",
        variant === "warning" && "support-feedback-message--warning",
        variant === "success" && "support-feedback-message--success",
        className,
      )}
    >
      <StatusIcon className="support-feedback-message__icon" strokeWidth={2.25} aria-hidden />
      <div className="support-feedback-message__content">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          className="support-feedback-message__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <X className="size-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
