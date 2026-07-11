"use client";

import { CheckCircle2 } from "lucide-react";

import type { KycPanDraft } from "@/features/kyc/lib/kyc-journey-draft";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycReviewPanSectionProps = {
  pan: KycPanDraft;
};

const fieldShellClassName =
  "flex h-9 w-full min-w-0 items-center rounded-[var(--radius-control)] border border-border/60 bg-muted/35 px-2.5 text-caption font-semibold tracking-tight text-foreground";

function PanReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className={fieldShellClassName}>
        <span className="truncate">{value || "—"}</span>
      </div>
    </div>
  );
}

export function KycReviewPanSection({ pan }: KycReviewPanSectionProps) {
  const fullName = [pan.firstName, pan.middleName, pan.lastName].filter(Boolean).join(" ");

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)]",
        "bg-gradient-to-br from-success/[0.06] via-card to-muted/15",
      )}
    >
      <div className="space-y-3 p-3">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              "bg-success/10 text-success ring-1 ring-inset ring-success/20",
            )}
          >
            <CheckCircle2 className="size-4" strokeWidth={2} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-caption font-semibold tracking-tight text-foreground">
                {copy.kyc.review.pan.verifiedTitle}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {copy.kyc.review.pan.verifiedDescription}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-primary/15 bg-primary/[0.04] px-3 py-3">
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {copy.kyc.pan.numberLabel}
          </p>
          <p className="mt-1 text-center font-mono text-h4 font-semibold uppercase tracking-[0.22em] text-foreground">
            {pan.panNumber}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-2">
          <PanReviewField label={copy.kyc.pan.firstNameLabel} value={pan.firstName} />
          <PanReviewField label={copy.kyc.pan.middleNameLabel} value={pan.middleName} />
          <PanReviewField label={copy.kyc.pan.lastNameLabel} value={pan.lastName} />
        </div>

        {fullName ? (
          <div className="rounded-[var(--radius-control)] border border-border/50 bg-background/60 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {copy.kyc.review.fullName}
            </p>
            <p className="mt-0.5 text-caption font-semibold text-foreground">{fullName}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
