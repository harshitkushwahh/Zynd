"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Loader2, Plus } from "lucide-react";

import { BankLogo } from "@/components/banking/bank-logo";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  formatBankAccountPickerLabel,
  resolveBankAccountDisplayName,
} from "@/shared/lib/bank-account-display";
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
  onAddAccount?: () => void;
  canAddAccount?: boolean;
  addAccountLabel?: string;
};

function sortBankAccountsForPicker(accounts: InvestorBankAccount[]) {
  return [...accounts].sort((left, right) => {
    if (left.is_primary !== right.is_primary) {
      return left.is_primary ? -1 : 1;
    }
    return (left.bank_name ?? "").localeCompare(right.bank_name ?? "");
  });
}

function accountLabel(account: InvestorBankAccount) {
  return formatBankAccountPickerLabel({
    bankName: account.bank_name,
    ifscCode: account.ifsc_code,
    accountNumberMasked: account.account_number_masked,
    accountNumberLast4: account.account_number_last4,
    unknownBankLabel: copy.mutualFunds.bankPickerUnknownBank,
  });
}

function accountSubtitle(account: InvestorBankAccount) {
  const typeLabel = formatInvestorBankAccountType(account.account_type);
  return `${typeLabel} · ${account.ifsc_code}`;
}

function BankAccountOptionContent({
  account,
  showPrimaryBadge = true,
  compact = false,
}: {
  account: InvestorBankAccount;
  showPrimaryBadge?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <BankLogo
        bankName={resolveBankAccountDisplayName({
          bankName: account.bank_name,
          ifscCode: account.ifsc_code,
        })}
        ifscCode={account.ifsc_code}
        size={compact ? "sm" : "md"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-compact font-medium text-foreground">{accountLabel(account)}</p>
          {showPrimaryBadge && account.is_primary ? (
            <Badge variant="secondary" className="h-auto shrink-0 px-2 py-0.5 text-[10px] font-semibold leading-none">
              {copy.settings.bankAccounts.primaryBadge}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-caption text-muted-foreground">{accountSubtitle(account)}</p>
      </div>
    </div>
  );
}

function BankAccountRadioIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border",
        selected ? "border-primary bg-primary" : "border-border bg-background",
      )}
      aria-hidden="true"
    >
      {selected ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
    </span>
  );
}

function BankAccountSelectItem({
  account,
  selected,
}: {
  account: InvestorBankAccount;
  selected: boolean;
}) {
  return (
    <SelectPrimitive.Item
      value={account.id}
      className="relative flex w-full cursor-default items-center rounded-[var(--radius-control)] py-3.5 pl-2 pr-3 text-compact outline-none select-none transition-colors duration-150 ease-out data-highlighted:bg-muted data-highlighted:text-foreground focus:bg-muted focus:text-foreground data-selected:bg-primary/8 data-selected:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
    >
      <SelectPrimitive.ItemText className="flex w-full min-w-0 items-center gap-3 whitespace-normal">
        <BankAccountOptionContent account={account} />
        <BankAccountRadioIndicator selected={selected} />
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function AddAccountDropdownAction({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="border-t border-border p-2">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-left text-compact font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={onClick}
      >
        <Plus className="size-4 shrink-0" aria-hidden />
        {label}
      </button>
    </div>
  );
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
  onAddAccount,
  canAddAccount = false,
  addAccountLabel,
}: MfBankAccountPickerProps) {
  const sortedAccounts = sortBankAccountsForPicker(accounts);
  const selectedAccount =
    sortedAccounts.find((account) => account.id === selectedId) ?? sortedAccounts[0] ?? null;
  const resolvedSelectedId = selectedAccount?.id ?? null;
  const addLabel =
    addAccountLabel ??
    (sortedAccounts.length === 0
      ? copy.mutualFunds.bankPickerAddAccount
      : copy.mutualFunds.bankPickerAddAnother);
  const showAddInDropdown = Boolean(canAddAccount && onAddAccount);
  const useSelect = sortedAccounts.length > 1 || (sortedAccounts.length === 1 && showAddInDropdown);

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-card)] border border-border px-4 py-3 text-compact text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        {copy.mutualFunds.bankPickerLoading}
      </div>
    );
  }

  if (error) {
    return <FieldMessage variant="error" message={error} className={className} />;
  }

  if (sortedAccounts.length === 0) {
    return (
      <div
        className={cn(
          "space-y-3 rounded-[var(--radius-card)] border border-dashed border-border px-4 py-4",
          className,
        )}
      >
        <p className="text-compact text-muted-foreground">{copy.mutualFunds.bankPickerEmpty}</p>
        {showAddInDropdown ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-compact font-medium text-primary hover:underline"
            onClick={onAddAccount}
          >
            <Plus className="size-4" aria-hidden />
            {addLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <p className="text-caption font-medium text-muted-foreground">{label}</p> : null}

      {!useSelect && selectedAccount ? (
        <div className="rounded-[var(--radius-card)] border border-primary/25 bg-primary/[0.03] px-4 py-3.5">
          <BankAccountOptionContent account={selectedAccount} />
        </div>
      ) : (
        <Select
          value={resolvedSelectedId}
          onValueChange={(value) => {
            if (value) onSelect(value);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-auto !min-h-[4.5rem] !w-full items-center rounded-[var(--radius-card)] px-4 py-3.5">
            <SelectValue
              placeholder={copy.mutualFunds.bankPickerLabel}
              className="line-clamp-none overflow-visible"
            >
              {selectedAccount ? (
                <BankAccountOptionContent account={selectedAccount} />
              ) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="min-w-[var(--anchor-width)]">
            {sortedAccounts.map((account) => (
              <BankAccountSelectItem
                key={account.id}
                account={account}
                selected={account.id === resolvedSelectedId}
              />
            ))}
            {showAddInDropdown ? (
              <AddAccountDropdownAction onClick={onAddAccount!} label={addLabel} />
            ) : null}
          </SelectContent>
        </Select>
      )}

      {hint && sortedAccounts.length > 0 ? (
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
        <BankLogo
          bankName={bankName}
          ifscCode={ifsc}
          size="sm"
          fallbackClassName="bg-success/15 text-success ring-success/25"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-compact font-medium text-foreground">{label}</p>
          {subtitle ? <p className="mt-0.5 truncate text-caption text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}
