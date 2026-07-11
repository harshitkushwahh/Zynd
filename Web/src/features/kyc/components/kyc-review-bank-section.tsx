"use client";

import { Building2, CheckCircle2 } from "lucide-react";

import type { KycJourneyDraft } from "@/features/kyc/lib/kyc-journey-draft";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycReviewBankSectionProps = {
  bank: NonNullable<KycJourneyDraft["bank"]>;
};

const fieldShellClassName =
  "flex h-9 w-full min-w-0 items-center rounded-[var(--radius-control)] border border-border/60 bg-muted/35 px-2.5 text-caption font-semibold tracking-tight text-foreground";

function BankReviewField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className={fieldShellClassName}>
        <span className={cn("truncate", mono && "font-mono uppercase tracking-wide")}>{value || "—"}</span>
      </div>
    </div>
  );
}

function maskAccountNumber(accountNumber: string) {
  if (accountNumber.length <= 4) return accountNumber;
  return `•••• •••• ${accountNumber.slice(-4)}`;
}

export function KycReviewBankSection({ bank }: KycReviewBankSectionProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)]",
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

          <div className="min-w-0 flex-1">
            <p className="text-caption font-semibold tracking-tight text-foreground">
              {copy.kyc.review.bank.verifiedTitle}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {copy.kyc.review.bank.verifiedDescription}
            </p>
          </div>

          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              "bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/20",
            )}
          >
            <Building2 className="size-4" strokeWidth={2} />
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-primary/15 bg-primary/[0.04] px-3 py-3">
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {copy.kyc.bank.fields.accountNumber}
          </p>
          <p className="mt-1 text-center font-mono text-h4 font-semibold tracking-[0.14em] text-foreground">
            {maskAccountNumber(bank.accountNumber)}
          </p>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            {bank.accountDetails.bankName} · {bank.accountType}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-2">
          <BankReviewField
            label={copy.kyc.bank.fields.accountHolderName}
            value={bank.accountDetails.accountHolderName}
          />
          <BankReviewField label={copy.kyc.bank.fields.ifscCode} value={bank.ifscCode} mono />
          <BankReviewField label={copy.kyc.bank.fields.bankName} value={bank.accountDetails.bankName} />
          <BankReviewField label={copy.kyc.bank.fields.branch} value={bank.accountDetails.branch} />
        </div>
      </div>
    </div>
  );
}
