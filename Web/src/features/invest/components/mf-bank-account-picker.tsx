"use client";

import Link from "next/link";
import { Building2, Loader2 } from "lucide-react";

import { FieldMessage } from "@/components/ui/ui-message";
import {
  formatInvestorBankAccountType,
  type InvestorBankAccount,
} from "@/features/invest/lib/investor-bank-accounts-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfBankAccountPickerProps = {
  accounts: InvestorBankAccount[];
  selectedId: string | null;
  onSelect: (accountId: string) => void;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  hint?: string;
};

function accountLabel(account: InvestorBankAccount) {
  const bankName = account.bank_name?.trim() || copy.mutualFunds.bankPickerUnknownBank;
  const masked = account.account_number_masked || `•••• ${account.account_number_last4}`;
  return `${bankName} ${masked}`;
}

function accountSubtitle(account: InvestorBankAccount) {
  const typeLabel = formatInvestorBankAccountType(account.account_type);
  return `${typeLabel} · ${account.ifsc_code}`;
}

export function MfBankAccountPicker({
  accounts,
  selectedId,
  onSelect,
  loading = false,
  error = "",
  disabled = false,
  className,
  label = "",
  hint = "",
}: MfBankAccountPickerProps) {
  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 rounded-[var(--radius-card)] border border-border px-4 py-3 text-compact text-muted-foreground", className)}>
        <Loader2 className="size-4 animate-spin" />
        {copy.mutualFunds.bankPickerLoading}
      </div>
    );
  }

  if (error) {
    return <FieldMessage variant="error" message={error} className={className} />;
  }

  if (accounts.length === 0) {
    return (
      <div className={cn("space-y-2 rounded-[var(--radius-card)] border border-dashed border-border px-4 py-4", className)}>
        <p className="text-compact text-muted-foreground">{copy.mutualFunds.bankPickerEmpty}</p>
        <Link href="/dashboard/settings" className="text-compact font-medium text-primary hover:underline">
          {copy.mutualFunds.bankPickerAddAccount}
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <p className="text-caption font-medium text-muted-foreground">{label}</p> : null}
      <ul className="space-y-2">
        {accounts.map((account) => {
          const isSelected = selectedId === account.id;
          return (
            <li key={account.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(account.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius-card)] border px-3.5 py-3 text-left transition-colors",
                  isSelected
                    ? "border-primary/35 bg-primary/5 ring-1 ring-primary/15"
                    : "border-border/80 bg-muted/15 hover:border-primary/25 hover:bg-muted/25",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Building2 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-compact font-medium text-foreground">{accountLabel(account)}</p>
                  <p className="mt-0.5 truncate text-caption text-muted-foreground">{accountSubtitle(account)}</p>
                </div>
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    isSelected ? "border-primary bg-primary" : "border-border bg-background",
                  )}
                  aria-hidden="true"
                >
                  {isSelected ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {hint && accounts.length > 0 ? (
        <p className="text-caption text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

type MfPayoutBankSummaryProps = {
  masked?: string | null;
  ifsc?: string | null;
  bankName?: string | null;
  className?: string;
};

export function MfPayoutBankSummary({ masked, ifsc, bankName, className }: MfPayoutBankSummaryProps) {
  if (!masked && !ifsc && !bankName) return null;

  const label = [bankName?.trim() || copy.mutualFunds.bankPickerUnknownBank, masked].filter(Boolean).join(" ");
  const subtitle = ifsc ? `${copy.mutualFunds.bankPickerPayoutIfsc} ${ifsc}` : null;

  return (
    <div className={cn("rounded-[var(--radius-card)] border border-border/70 bg-muted/10 px-3.5 py-2.5", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {copy.mutualFunds.bankPickerPayoutLabel}
      </p>
      <div className="mt-1.5 flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
          <Building2 className="size-3.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-compact font-medium text-foreground">{label}</p>
          {subtitle ? <p className="mt-0.5 truncate text-caption text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}
