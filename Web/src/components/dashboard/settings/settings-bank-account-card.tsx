"use client";

import { Building2, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatInvestorBankAccountType,
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
      <StatusBadge key="primary" variant="info" className="h-5 px-2 text-[10px]">
        <Star className="mr-1 size-3" />
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
  return badges;
}

export function SettingsBankAccountCard({
  account,
  settingPrimary = false,
  removing = false,
  onSetPrimary,
  onRemove,
}: SettingsBankAccountCardProps) {
  const canSetPrimary = isInvestorBankAccountVerified(account) && !account.is_primary;
  const canRemove = !account.is_primary && onRemove;

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
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Building2 className="size-4" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-semibold text-foreground">{account.account_number_masked}</p>
            {verificationBadges(account)}
          </div>

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
            <p className="text-[11px] text-destructive">{account.failure.reason}</p>
          ) : null}

          {canSetPrimary && onSetPrimary ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={settingPrimary || removing}
              onClick={() => onSetPrimary(account.id)}
            >
              {settingPrimary ? copy.settings.working : copy.settings.bankAccounts.setPrimary}
            </Button>
          ) : null}

          {canRemove ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={removing || settingPrimary}
              onClick={() => onRemove(account.id)}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              {removing ? copy.settings.working : copy.settings.bankAccounts.removeBankAccount}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
