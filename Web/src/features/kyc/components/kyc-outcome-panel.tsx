"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { KycJsonLottie } from "@/features/kyc/components/kyc-json-lottie";
import { KycOutcomePanCard } from "@/features/kyc/components/kyc-outcome-pan-card";
import {
  KYC_SUCCESS_LOTTIE_SRC,
  KYC_WAITING_LOTTIE_SRC,
  type KycOutcomeVariant,
} from "@/features/kyc/lib/kyc-outcome-lottie";
import { fireKycSuccessConfetti } from "@/features/kyc/lib/kyc-success-confetti";
import { cn } from "@/lib/utils";

export type { KycOutcomeVariant } from "@/features/kyc/lib/kyc-outcome-lottie";

export type KycOutcomePanelCopy = {
  description: string;
  detailLabel?: string;
  detailValue?: string;
  actionLabel?: string;
};

type KycOutcomePanelProps = {
  variant: KycOutcomeVariant;
  copy: KycOutcomePanelCopy;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  actionLoading?: boolean;
  className?: string;
};

const variantStyles = {
  success: {
    ring: "ring-success/15",
    surface: "from-success/[0.08] via-card to-muted/10",
  },
  waiting: {
    ring: "ring-warning/20",
    surface: "from-warning/[0.08] via-card to-muted/10",
  },
};

export function KycOutcomePanel({
  variant,
  copy,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  actionLoading = false,
  className,
}: KycOutcomePanelProps) {
  const styles = variantStyles[variant];
  const lottieSrc = variant === "success" ? KYC_SUCCESS_LOTTIE_SRC : KYC_WAITING_LOTTIE_SRC;

  useEffect(() => {
    if (variant !== "success") return;
    fireKycSuccessConfetti();
  }, [variant]);

  return (
    <div className={cn("flex flex-col items-center gap-4 py-2 text-center", className)}>
      <div
        className={cn(
          "flex size-[6.75rem] items-center justify-center rounded-full bg-gradient-to-br p-2 ring-1 ring-inset",
          styles.ring,
          styles.surface,
        )}
      >
        <KycJsonLottie
          src={lottieSrc}
          loop={variant === "waiting"}
          className="size-24 max-w-[6.5rem]"
        />
      </div>

      <div className="flex w-full max-w-[16.5rem] flex-col items-center gap-2.5">
        <p className="text-compact leading-relaxed text-muted-foreground">{copy.description}</p>

        {copy.detailLabel && copy.detailValue ? (
          <KycOutcomePanCard
            label={copy.detailLabel}
            pan={copy.detailValue}
            variant={variant}
          />
        ) : null}
      </div>

      {copy.actionLabel && onAction ? (
        <Button size="default" className="min-w-[8.5rem]" onClick={onAction} disabled={actionLoading}>
          {actionLoading ? "…" : copy.actionLabel}
        </Button>
      ) : null}

      {secondaryActionLabel && onSecondaryAction ? (
        <Button variant="ghost" size="sm" onClick={onSecondaryAction} disabled={actionLoading}>
          {secondaryActionLabel}
        </Button>
      ) : null}
    </div>
  );
}
