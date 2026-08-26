"use client";

import { CheckCircle2, Loader2, PencilLine } from "lucide-react";

import { BankLogo } from "@/components/banking/bank-logo";

import { StatusBadge } from "@/components/ui/status-badge";
import { KycPanReadinessBadge } from "@/features/kyc/components/kyc-pan-readiness-badge";
import type { KycBankAccountDetails, KycBankVerificationResult } from "@/features/kyc/lib/kyc-bank";
import type { KycReadinessInfo } from "@/features/kyc/lib/kyc-pan-readiness";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycBankAccountCardProps = {
  isProcessing: boolean;
  isComplete: boolean;
  accountDetails: KycBankAccountDetails | null;
  verification: KycBankVerificationResult | null;
  ifscCode?: string | null;
  readiness?: KycReadinessInfo | null;
  onEdit?: () => void;
};

const fieldShellClassName =
  "flex h-8 w-full min-w-0 items-center rounded-[var(--radius-control)] border border-border/60 bg-muted/35 px-2 text-[12px] font-semibold tracking-tight text-foreground";

function BankDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className={fieldShellClassName}>
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function KycBankVerificationBadges({
  verification,
  readiness,
}: {
  verification: KycBankVerificationResult;
  readiness?: KycReadinessInfo | null;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <KycPanReadinessBadge readiness={readiness} />
      {verification.panVerified ? (
        <StatusBadge variant="success" className="h-5 px-2 text-[10px]">
          {copy.kyc.bank.badges.panVerified}
        </StatusBadge>
      ) : null}
      {verification.bankVerified ? (
        <StatusBadge variant="success" className="h-5 px-2 text-[10px]">
          {copy.kyc.bank.badges.bankVerified}
        </StatusBadge>
      ) : null}
      {verification.readinessVerified ? (
        <StatusBadge variant="success" className="h-5 px-2 text-[10px]">
          {copy.kyc.bank.badges.readinessVerified}
        </StatusBadge>
      ) : (
        <StatusBadge variant="warning" className="h-5 px-2 text-[10px]">
          {copy.kyc.bank.badges.readinessPending}
        </StatusBadge>
      )}
    </div>
  );
}

export function KycBankAccountCard({
  isProcessing,
  isComplete,
  accountDetails,
  verification,
  ifscCode,
  readiness,
  onEdit,
}: KycBankAccountCardProps) {
  const requiresManual = Boolean(verification?.requiresManualVerification && !isComplete);
  const showGenericPending = (!isComplete && !accountDetails) || isProcessing;

  if (showGenericPending) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[var(--radius-card)] px-3 py-2.5 transition-colors",
          requiresManual
            ? "border border-warning/30 bg-gradient-to-br from-warning/[0.08] via-card to-muted/20 shadow-zynd-low"
            : "border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.04] via-card to-muted/20 shadow-zynd-low",
        )}
      >
        <div
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
            requiresManual
              ? "bg-warning/10 text-warning ring-warning/20"
              : "bg-primary/[0.08] text-primary ring-primary/20",
          )}
        >
          {isProcessing ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <BankLogo
              ifscCode={ifscCode}
              bankName={accountDetails?.bankName}
              size="sm"
              fallbackClassName="bg-primary/[0.08] text-primary ring-primary/20"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1 text-left leading-tight">
          <p className="text-caption font-semibold tracking-tight text-foreground">
            {isProcessing
              ? copy.kyc.bank.verifyingTitle
              : requiresManual
                ? copy.kyc.bank.manualPendingTitle
                : copy.kyc.bank.namePendingTitle}
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {isProcessing
              ? copy.kyc.bank.verifyingDescription
              : requiresManual
                ? verification?.failureReason ?? copy.kyc.bank.manualPendingDescription
                : copy.kyc.bank.namePendingDescription}
          </p>
        </div>
      </div>
    );
  }

  if (!accountDetails) {
    return null;
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-[var(--radius-card)] border border-border p-2.5 shadow-zynd-low",
        requiresManual
          ? "border-warning/30 bg-gradient-to-br from-warning/[0.08] via-card to-muted/15"
          : "bg-gradient-to-br from-success/[0.06] via-card to-muted/15",
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
            requiresManual
              ? "bg-warning/10 text-warning ring-warning/20"
              : "bg-success/10 text-success ring-success/20",
          )}
        >
          <CheckCircle2 className="size-3.5" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div>
            <p className="text-[13px] font-semibold leading-tight tracking-tight text-foreground">
              {requiresManual ? copy.kyc.bank.manualPendingTitle : copy.kyc.bank.verifiedTitle}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
              {requiresManual
                ? verification?.failureReason ?? copy.kyc.bank.manualPendingDescription
                : copy.kyc.bank.verifiedDescription}
            </p>
          </div>
          {verification ? (
            <KycBankVerificationBadges verification={verification} readiness={readiness} />
          ) : null}
        </div>

        <BankLogo
          bankName={accountDetails.bankName}
          ifscCode={ifscCode}
          size="sm"
          fallbackClassName="bg-success/10 text-success ring-success/20"
        />

        {isComplete && !requiresManual && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            disabled={isProcessing}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label={copy.kyc.bank.editBankDetails}
          >
            <PencilLine className="size-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <BankDetailField
          label={copy.kyc.bank.fields.accountHolderName}
          value={accountDetails.accountHolderName}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <BankDetailField label={copy.kyc.bank.fields.bankName} value={accountDetails.bankName} />
          <BankDetailField label={copy.kyc.bank.fields.branch} value={accountDetails.branch} />
        </div>
      </div>
    </div>
  );
}
