"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { KycJsonLottie } from "@/features/kyc/components/kyc-json-lottie";
import { KycOutcomePanCard } from "@/features/kyc/components/kyc-outcome-pan-card";
import {
  KYC_SUCCESS_LOTTIE,
  KYC_WAITING_LOTTIE,
  type KycOutcomeVariant,
} from "@/features/kyc/lib/kyc-outcome-lottie";
import { fireKycSuccessConfetti } from "@/features/kyc/lib/kyc-success-confetti";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

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
  const { user } = useAuth();
  const styles = variantStyles[variant];
  const lottieAnimation = variant === "success" ? KYC_SUCCESS_LOTTIE : KYC_WAITING_LOTTIE;

  useEffect(() => {
    if (variant !== "success") return;
    fireKycSuccessConfetti({
      userId: user?.id,
      oncePerUser: true,
    });
  }, [variant, user?.id]);

  return (
    <div
      className={cn(
        "kyc-outcome-panel mx-auto flex w-full flex-col items-center gap-4 py-2 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-[7.25rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br p-1.5 ring-1 ring-inset",
          styles.ring,
          styles.surface,
        )}
      >
        <KycJsonLottie
          key={variant}
          animationData={lottieAnimation}
          loop={variant === "waiting"}
          holdOnComplete={variant === "success"}
          className="size-[5.5rem] shrink-0"
        />
      </div>

      <div className="flex w-full flex-col items-center gap-2.5">
        <p className="text-compact leading-relaxed text-muted-foreground">{copy.description}</p>

        {copy.detailLabel && copy.detailValue ? (
          <KycOutcomePanCard
            label={copy.detailLabel}
            pan={copy.detailValue}
            variant={variant}
            className="w-full"
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
