"use client";

import { Button } from "@/components/ui/button";
import { KycDigilockerImage } from "@/features/kyc/components/kyc-digilocker-image";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDigilockerInfoCardProps = {
  variant?: "required" | "failed";
  layout?: "inline" | "prominent";
  description?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

export function KycDigilockerInfoCard({
  variant = "failed",
  layout = "inline",
  description,
  onRetry,
  retrying = false,
  className,
}: KycDigilockerInfoCardProps) {
  const isRequired = variant === "required";
  const isProminent = layout === "prominent";
  const title = isRequired ? copy.kyc.digilocker.requiredTitle : copy.kyc.digilocker.failedTitle;
  const body =
    description?.trim() ||
    (isRequired ? copy.kyc.digilocker.requiredDescription : copy.kyc.digilocker.failedDescription);
  const actionLabel = isRequired
    ? copy.kyc.digilocker.requiredAction
    : copy.kyc.digilocker.retry;

  if (isProminent) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-4 rounded-[1.75rem] border border-dashed px-6 pb-8 pt-6 text-center",
          isRequired
            ? "border-primary/30 bg-gradient-to-b from-primary/[0.06] via-card to-muted/20"
            : "border-warning/35 bg-gradient-to-b from-warning/[0.06] via-card to-muted/20",
          className,
        )}
      >
        <KycDigilockerImage variant="address" />

        <div className="max-w-sm space-y-2">
          <p className="text-body font-semibold tracking-tight text-foreground">{title}</p>
          <p className="text-caption leading-relaxed text-muted-foreground">{body}</p>
          {!isRequired ? (
            <p className="text-caption font-medium leading-relaxed text-foreground">
              {copy.kyc.digilocker.aadhaarCheckboxHint}
            </p>
          ) : null}
        </div>

        {onRetry ? (
          <Button type="button" className="w-full max-w-sm" disabled={retrying} onClick={onRetry}>
            {retrying ? copy.kyc.digilocker.retrying : actionLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-4 rounded-[var(--radius-card)] border px-4 py-4 shadow-zynd-low",
        isRequired
          ? "border-primary/25 bg-gradient-to-br from-primary/[0.05] via-card to-muted/15"
          : "border-warning/30 bg-gradient-to-br from-warning/[0.06] via-card to-muted/15",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <KycDigilockerImage variant="compact" />

        <div className="min-w-0 flex-1 text-left leading-tight">
          <p className="text-caption font-semibold tracking-tight text-foreground">{title}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{body}</p>
          {!isRequired ? (
            <p className="mt-2 text-[11px] font-medium leading-snug text-foreground">
              {copy.kyc.digilocker.aadhaarCheckboxHint}
            </p>
          ) : null}
        </div>
      </div>

      {onRetry ? (
        <Button type="button" className="w-full" disabled={retrying} onClick={onRetry}>
          {retrying ? copy.kyc.digilocker.retrying : actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
