"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import digiImage from "../../../../public/digi.png";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDigilockerInfoCardProps = {
  variant?: "required" | "failed";
  description?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

export function KycDigilockerInfoCard({
  variant = "failed",
  description,
  onRetry,
  retrying = false,
  className,
}: KycDigilockerInfoCardProps) {
  const isRequired = variant === "required";
  const title = isRequired ? copy.kyc.digilocker.requiredTitle : copy.kyc.digilocker.failedTitle;
  const body =
    description?.trim() ||
    (isRequired ? copy.kyc.digilocker.requiredDescription : copy.kyc.digilocker.failedDescription);

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
        <div
          className={cn(
            "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-inset",
            isRequired
              ? "bg-primary/[0.08] ring-primary/20"
              : "bg-warning/10 ring-warning/25",
          )}
        >
          <Image
            src={digiImage}
            alt={copy.kyc.digilocker.title}
            className="size-8 object-contain"
            priority
          />
        </div>

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
          {retrying ? copy.kyc.digilocker.retrying : copy.kyc.digilocker.retry}
        </Button>
      ) : null}
    </div>
  );
}
