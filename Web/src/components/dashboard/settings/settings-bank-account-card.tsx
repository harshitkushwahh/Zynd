"use client";

import { Loader2, Star, Trash2 } from "lucide-react";

import { BankLogo } from "@/components/banking/bank-logo";

import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatInvestorBankAccountType,
  isInvestorBankAccountPaymentReady,
  isInvestorBankAccountVerified,
  type InvestorBankAccount,
} from "@/features/invest/lib/investor-bank-accounts-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type SettingsBankAccountCardProps = {
  account: InvestorBankAccount;
  settingPrimary?: boolean;
  removing?: boolean;
  onSetPrimary?: (accountId: string) => void;
  onRemove?: (accountId: string) => void;
};

function verificationBadges(account: InvestorBankAccount) {
  const badges = [];
  if (account.is_primary) {
    badges.push(
      <StatusBadge
        key="primary"
        variant="info"
        icon={Star}
        className="min-w-[5.75rem] justify-center px-3.5"
      >
        {copy.settings.bankAccounts.primaryBadge}
      </StatusBadge>,
    );
  }
  if (isInvestorBankAccountVerified(account)) {
    badges.push(
      <StatusBadge key="verified" variant="success" className="h-5 px-2 text-[10px]">
        {copy.settings.bankAccounts.verifiedBadge}
      </StatusBadge>,
    );
  } else if (account.verification_status === "manual_required") {
    badges.push(
      <StatusBadge key="manual" variant="warning" className="h-5 px-2 text-[10px]">
        {copy.settings.bankAccounts.manualRequiredBadge}
      </StatusBadge>,
    );
  } else if (account.verification_status === "failed") {
    badges.push(
      <StatusBadge key="failed" variant="destructive" className="h-5 px-2 text-[10px]">
        {copy.settings.bankAccounts.failedBadge}
      </StatusBadge>,
    );
  } else {
    badges.push(
      <StatusBadge key="pending" variant="neutral" className="h-5 px-2 text-[10px]">
        {copy.settings.bankAccounts.pendingBadge}
      </StatusBadge>,
    );
  }
  if (isInvestorBankAccountPaymentReady(account)) {
    badges.push(
      <StatusBadge key="payment-ready" variant="success" className="h-5 px-2 text-[10px]">
        {copy.settings.bankAccounts.paymentReadyBadge}
      </StatusBadge>,
    );
  }
  return badges;
}

export function SettingsBankAccountCard({
  account,
  settingPrimary = false,
  removing = false,
  onSetPrimary,
  onRemove,
}: SettingsBankAccountCardProps) {
  const activeSipCount = account.active_sip_count ?? 0;
  const canSetPrimary =
    isInvestorBankAccountVerified(account) && !account.is_primary && !account.blocks_primary_switch;
  const canRemove = !account.is_primary && onRemove;

  const showActions = (canSetPrimary && onSetPrimary) || canRemove;

  return (
    <article
      className={cn(
        "rounded-[var(--radius-card)] border p-4 shadow-zynd-low",
        account.is_primary
          ? "border-primary/25 bg-gradient-to-br from-primary/[0.05] via-card to-muted/15"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-start gap-3">
        <BankLogo bankName={account.bank_name} ifscCode={account.ifsc_code} size="md" />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-semibold text-foreground">{account.account_number_masked}</p>
            {verificationBadges(account)}
          </div>

          {activeSipCount > 0 ? (
            <p className="text-caption text-muted-foreground">
              {copy.settings.bankAccounts.activeSipsSubtitle(activeSipCount)}
            </p>
          ) : null}

          <dl className="grid gap-2 text-caption sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{copy.kyc.bank.fields.accountHolderName}</dt>
              <dd className="font-medium text-foreground">{account.account_holder_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.kyc.bank.fields.accountType}</dt>
              <dd className="font-medium text-foreground">
                {formatInvestorBankAccountType(account.account_type)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.kyc.bank.fields.ifscCode}</dt>
              <dd className="font-mono font-medium uppercase tracking-wide text-foreground">
                {account.ifsc_code}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.kyc.bank.fields.bankName}</dt>
              <dd className="font-medium text-foreground">{account.bank_name || copy.settings.notSet}</dd>
            </div>
          </dl>

          {account.failure?.reason ? (
            <FieldMessage message={account.failure.reason} className="mt-0" />
          ) : null}
        </div>

        {showActions ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {canSetPrimary && onSetPrimary ? (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={settingPrimary || removing}
                aria-label={copy.settings.bankAccounts.setPrimary}
                onClick={() => onSetPrimary(account.id)}
              >
                {settingPrimary ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Star className="size-3.5" aria-hidden />
                )}
              </Button>
            ) : null}
            {canRemove ? (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={removing || settingPrimary}
                aria-label={copy.settings.bankAccounts.removeBankAccount}
                onClick={() => onRemove(account.id)}
              >
                {removing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-3.5" aria-hidden />
                )}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
