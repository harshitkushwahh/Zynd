"use client";

import { CreditCard } from "lucide-react";

import type { KycOutcomeVariant } from "@/features/kyc/lib/kyc-outcome-lottie";
import { maskPanNumber } from "@/features/kyc/lib/mask-pan-number";
import { cn } from "@/lib/utils";

type KycOutcomePanCardProps = {
  label: string;
  pan: string;
  variant: KycOutcomeVariant;
  className?: string;
};

function MaskedPanValue({ pan }: { pan: string }) {
  const masked = maskPanNumber(pan);

  if (masked.length <= 2) {
    return (
      <span className="font-mono text-body font-semibold uppercase tracking-[0.18em] text-foreground">
        {masked}
      </span>
    );
  }

  const first = masked[0];
  const middle = masked.slice(1, -1);
  const last = masked[masked.length - 1];

  return (
    <span
      className="inline-flex items-center gap-0.5 font-mono text-body font-semibold uppercase"
      aria-label={`PAN ending in ${last}`}
    >
      <span className="tracking-[0.12em] text-foreground">{first}</span>
      <span className="tracking-[0.28em] text-muted-foreground/55">{middle}</span>
      <span className="tracking-[0.12em] text-foreground">{last}</span>
    </span>
  );
}

const variantStyles = {
  success: {
    shell: "border-success/20 bg-gradient-to-br from-success/[0.07] via-card to-muted/10",
    iconShell: "bg-success/10 text-success ring-success/20",
    chip: "bg-success/10 text-success",
    panSurface: "border-success/15 bg-success/[0.04]",
  },
  waiting: {
    shell: "border-warning/25 bg-gradient-to-br from-warning/[0.07] via-card to-muted/10",
    iconShell: "bg-warning/10 text-warning ring-warning/20",
    chip: "bg-warning/10 text-warning",
    panSurface: "border-warning/15 bg-warning/[0.04]",
  },
} as const;

export function KycOutcomePanCard({ label, pan, variant, className }: KycOutcomePanCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[var(--radius-card)] border shadow-zynd-low",
        styles.shell,
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-border/45 px-3 py-2">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
            styles.iconShell,
          )}
        >
          <CreditCard className="size-3.5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
        </div>
        <span
          className={cn(
            "rounded-[var(--radius-full)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            styles.chip,
          )}
        >
          PAN
        </span>
      </div>

      <div
        className={cn(
          "mx-3 mb-3 mt-2.5 flex justify-center rounded-[var(--radius-control)] border px-3 py-2.5",
          styles.panSurface,
        )}
      >
        <MaskedPanValue pan={pan} />
      </div>
    </div>
  );
}
