"use client";

import type { ReactNode } from "react";
import { Loader2, PencilLine } from "lucide-react";

import { BankLogo } from "@/components/banking/bank-logo";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  isKycBankBranchPlaceholder,
  type KycBankAccountDetails,
  type KycBankVerificationResult,
} from "@/features/kyc/lib/kyc-bank";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycBankAccountCardProps = {
  isProcessing: boolean;
  isFetchingIfsc?: boolean;
  isComplete: boolean;
  accountDetails: KycBankAccountDetails | null;
  verification: KycBankVerificationResult | null;
  ifscCode?: string | null;
  onEdit?: () => void;
};

/** Tab-style badge: rounded top, square bottom so it reads as jointed to the card border. */
const jointStatusBadgeClassName =
  "h-5 max-w-none !rounded-b-none !rounded-t-[var(--radius-control)] rounded-bl-none rounded-br-none px-2.5 text-[10px] shadow-zynd-low ring-2 ring-card";

function BankAccountCardShell({
  badge,
  children,
  className,
}: {
  badge: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative pt-2.5">
      <div className="absolute left-3 top-0 z-10 translate-y-[calc(-50%+1px)]">{badge}</div>
      <div className={className}>{children}</div>
    </div>
  );
}

function BankAccountSummary({
  accountDetails,
  ifscCode,
  onEdit,
  isProcessing,
}: {
  accountDetails: KycBankAccountDetails;
  ifscCode?: string | null;
  onEdit?: () => void;
  isProcessing?: boolean;
}) {
  const branchLabel = isKycBankBranchPlaceholder(accountDetails.branch)
    ? ""
    : accountDetails.branch.trim();

  return (
    <div className="flex items-start gap-3">
      <BankLogo
        bankName={accountDetails.bankName}
        ifscCode={ifscCode}
        size="sm"
        fallbackClassName="bg-primary/[0.08] text-primary ring-primary/20"
      />

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="truncate text-caption font-semibold leading-tight text-foreground">
          {accountDetails.bankName}
        </p>
        {branchLabel ? (
          <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
            {branchLabel}
          </p>
        ) : ifscCode?.trim() ? (
          <p className="mt-0.5 truncate font-mono text-[11px] leading-snug text-muted-foreground">
            {ifscCode.trim().toUpperCase()}
          </p>
        ) : null}
      </div>

      {onEdit ? (
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
  );
}

export function KycBankAccountCard({
  isProcessing,
  isFetchingIfsc = false,
  isComplete,
  accountDetails,
  verification,
  ifscCode,
  onEdit,
}: KycBankAccountCardProps) {
  const requiresManual = Boolean(verification?.requiresManualVerification && !isComplete);
  const isBankVerified = Boolean(isComplete && verification?.bankVerified);
  const showGenericPending =
    (!isComplete && !accountDetails) || isProcessing || isFetchingIfsc;

  if (showGenericPending) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[var(--radius-card)] border px-3 py-2.5 shadow-zynd-low",
          requiresManual
            ? "border-warning/30 bg-gradient-to-br from-warning/[0.08] via-card to-muted/20"
            : "border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.04] via-card to-muted/20",
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
          {isProcessing || isFetchingIfsc ? (
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

        <p className="min-w-0 flex-1 text-caption font-medium leading-snug text-foreground">
          {isProcessing
            ? copy.kyc.bank.verifyingTitle
            : isFetchingIfsc
              ? copy.kyc.bank.fetchingBranchTitle
              : requiresManual
                ? copy.kyc.bank.manualPendingTitle
                : copy.kyc.bank.detailsPendingTitle}
        </p>
      </div>
    );
  }

  if (!accountDetails) {
    return null;
  }

  if (isBankVerified && !requiresManual) {
    const kraReady = Boolean(verification?.readinessVerified);
    const badgeVariant = kraReady ? "success" : "info";
    const badgeLabel = kraReady
      ? copy.kyc.bank.badges.bankVerified
      : copy.kyc.bank.badges.accountVerified;
    const cardTint = kraReady
      ? "border-border bg-gradient-to-br from-success/[0.06] via-card to-muted/15"
      : "border-info/20 bg-gradient-to-br from-info/[0.06] via-card to-muted/15";

    return (
      <BankAccountCardShell
        badge={
          <StatusBadge variant={badgeVariant} className={jointStatusBadgeClassName}>
            {badgeLabel}
          </StatusBadge>
        }
      >
        <div className={cn("rounded-[var(--radius-card)] border px-3 pb-3 pt-4 shadow-zynd-low", cardTint)}>
          <BankAccountSummary
            accountDetails={accountDetails}
            ifscCode={ifscCode}
            isProcessing={isProcessing}
            onEdit={onEdit}
          />
        </div>
      </BankAccountCardShell>
    );
  }

  const pendingStatusBadge = requiresManual ? (
    <StatusBadge variant="warning" className={jointStatusBadgeClassName}>
      {copy.settings.bankAccounts.manualRequiredBadge}
    </StatusBadge>
  ) : (
    <StatusBadge variant="neutral" className={jointStatusBadgeClassName}>
      {copy.settings.bankAccounts.pendingBadge}
    </StatusBadge>
  );

  return (
    <BankAccountCardShell badge={pendingStatusBadge}>
      <div
        className={cn(
          "rounded-[var(--radius-card)] border px-3 pb-3 pt-4 shadow-zynd-low",
          requiresManual
            ? "border-warning/30 bg-gradient-to-br from-warning/[0.08] via-card to-muted/15"
            : "border-border bg-gradient-to-br from-muted/20 via-card to-muted/10",
        )}
      >
        <BankAccountSummary accountDetails={accountDetails} ifscCode={ifscCode} isProcessing={isProcessing} />
      </div>
    </BankAccountCardShell>
  );
}
