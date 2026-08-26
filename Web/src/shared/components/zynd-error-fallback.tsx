"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ZyndErrorFallbackProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  variant?: "inline" | "page";
  className?: string;
};

export function ZyndErrorFallback({
  title = copy.dashboard.error.boundaryTitle,
  description = copy.dashboard.error.boundaryDescription,
  retryLabel = copy.dashboard.error.retry,
  onRetry,
  variant = "page",
  className,
}: ZyndErrorFallbackProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center text-center",
        variant === "page" ? "min-h-0 flex-1 justify-center px-6 py-10" : "px-6 py-8",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full",
          "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/15",
        )}
      >
        <AlertTriangle className="size-6" strokeWidth={2.25} aria-hidden />
      </div>

      <h2 className="mt-4 text-h4 font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-caption leading-relaxed text-muted-foreground">{description}</p>

      {onRetry ? (
        <Button type="button" variant={variant === "inline" ? "outline" : "default"} size="sm" className="mt-6" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
