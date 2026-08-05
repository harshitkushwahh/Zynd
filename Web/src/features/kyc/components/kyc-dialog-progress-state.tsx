"use client";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDialogProgressStateProps = {
  variant: "loading" | "error";
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

export function KycDialogProgressState({
  variant,
  message,
  onRetry,
  retrying = false,
  className,
}: KycDialogProgressStateProps) {
  if (variant === "loading") {
    return (
      <div
        className={cn("flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-8 text-center", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/5 ring-1 ring-inset ring-primary/15">
          <Loader2 className="size-6 animate-spin text-primary" strokeWidth={2.25} aria-hidden />
        </div>
        <p className="text-compact text-muted-foreground">{copy.kyc.loading}</p>
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-12 text-center", className)}
      role="alert"
      aria-live="polite"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/5 ring-1 ring-inset ring-destructive/20">
        <AlertCircle className="size-7 text-destructive" strokeWidth={2} aria-hidden />
      </div>
      <div className="max-w-[18rem] space-y-1">
        <p className="text-compact font-medium text-foreground">{copy.kyc.bootstrapErrorTitle}</p>
        <p className="text-caption leading-relaxed text-muted-foreground">
          {message ?? copy.kyc.bootstrapErrorDescription}
        </p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="default"
          className="min-w-[8.5rem] gap-2"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          {retrying ? copy.kyc.bootstrapRetrying : copy.kyc.bootstrapRetry}
        </Button>
      ) : null}
    </div>
  );
}
