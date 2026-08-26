"use client";

import type { ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type UiMessageVariant = "error" | "success" | "warning" | "info";

const variantMap = {
  error: "destructive",
  success: "success",
  warning: "warning",
  info: "info",
} as const;

const iconMap = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

type UiMessageProps = {
  variant?: UiMessageVariant;
  message?: string;
  children?: ReactNode;
  className?: string;
};

export function UiMessage({
  variant = "error",
  message,
  children,
  className,
}: UiMessageProps) {
  if (!message && !children) {
    return null;
  }

  const Icon = iconMap[variant];

  return (
    <Alert
      variant={variantMap[variant]}
      className={cn(
        "mt-2 rounded-[var(--radius-card)] px-3 py-2.5 shadow-zynd-low",
        className
      )}
    >
      <Icon className="size-4" />
      <AlertDescription className="text-caption leading-relaxed">
        {message ?? children}
      </AlertDescription>
    </Alert>
  );
}

export function FieldMessage({
  message,
  variant = "error",
  className,
}: {
  message?: string;
  variant?: UiMessageVariant;
  className?: string;
}) {
  return (
    <UiMessage
      variant={variant}
      message={message}
      className={cn("mt-1.5", className)}
    />
  );
}
