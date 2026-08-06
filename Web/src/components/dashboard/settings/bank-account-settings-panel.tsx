"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";

import { SettingsAddBankAccountForm } from "@/components/dashboard/settings/settings-add-bank-account-form";
import { SettingsBankAccountCard } from "@/components/dashboard/settings/settings-bank-account-card";
import { SettingsPanelHeader } from "@/components/dashboard/settings/settings-panel-header";
import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import { SETTINGS_NAV } from "@/components/dashboard/settings/settings-sidebar";
import { Button } from "@/components/ui/button";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { useKycOptional } from "@/contexts/kyc-context";
import { useInvestorBankAccounts } from "@/features/invest/hooks/use-investor-bank-accounts";
import { setPrimaryInvestorBankAccount, disableInvestorBankAccount } from "@/features/invest/lib/investor-bank-accounts-api";
import { copy } from "@/shared/config/copy";

const MAX_BANK_ACCOUNTS = 5;

export function BankAccountSettingsPanel() {
  const sectionMeta = SETTINGS_NAV.find((item) => item.id === "bank-account")!;
  const kyc = useKycOptional();
  const kycVerified = kyc?.overallStatus === "completed";
  const { accounts, loading, error, reloadAccounts } = useInvestorBankAccounts(kycVerified);
  const [showAddForm, setShowAddForm] = useState(false);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const canAddMore = accounts.length < MAX_BANK_ACCOUNTS;

  const headerActions =
    kycVerified && !loading && !error && accounts.length > 0 && canAddMore && !showAddForm ? (
      <Button type="button" size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
        <Plus className="mr-1.5 size-4" />
        {copy.settings.bankAccounts.addBankAccount}
      </Button>
    ) : null;

  const handleSetPrimary = async (accountId: string) => {
    setSettingPrimaryId(accountId);
    setActionError("");
    setActionMessage("");
    try {
      await setPrimaryInvestorBankAccount(accountId);
      setActionMessage(copy.settings.bankAccounts.setPrimarySuccess);
      await reloadAccounts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : copy.settings.bankAccounts.setPrimaryFailed);
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleRemove = async (accountId: string) => {
    setRemovingId(accountId);
    setActionError("");
    setActionMessage("");
    try {
      await disableInvestorBankAccount(accountId);
      setActionMessage(copy.settings.bankAccounts.removeSuccess);
      await reloadAccounts();
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.settings.bankAccounts.removeFailed;
      if (message.includes("primary")) {
        setActionError(copy.settings.bankAccounts.removePrimaryBlocked);
      } else if (message.includes("mandate")) {
        setActionError(copy.settings.bankAccounts.removeMandateBlocked);
      } else {
        setActionError(message);
      }
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddSuccess = async () => {
    setShowAddForm(false);
    setActionError("");
    setActionMessage(copy.settings.bankAccounts.addSuccess);
    await reloadAccounts();
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Building2 className="size-5" strokeWidth={2} />
      </div>
      <div className="space-y-1">
        <p className="text-body font-semibold text-foreground">{copy.settings.bankAccountEmptyTitle}</p>
        <p className="max-w-sm text-caption text-muted-foreground">
          {copy.settings.bankAccountEmptyDescription}
        </p>
      </div>
      {kycVerified ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
          {copy.settings.bankAccounts.addBankAccount}
        </Button>
      ) : kyc?.kycAllowed ? (
        <Button type="button" size="sm" onClick={() => kyc.openDialog()}>
          {copy.kyc.menuLabel}
        </Button>
      ) : null}
    </div>
  );

  return (
    <SettingsContentCard
      header={
        <SettingsPanelHeader
          icon={sectionMeta.icon}
          title={sectionMeta.title}
          description={copy.settings.bankAccountDescription}
          actions={headerActions}
          descriptionSingleLine
        />
      }
    >
      {loading ? (
        <p className="text-caption text-muted-foreground">{copy.settings.bankAccounts.loading}</p>
      ) : error ? (
        <div className="space-y-4">
          <FieldMessage message={error} />
          {kyc?.kycAllowed ? (
            <Button type="button" size="sm" onClick={() => kyc.openDialog()}>
              {copy.kyc.menuLabel}
            </Button>
          ) : null}
        </div>
      ) : !kycVerified && kyc?.kycAllowed ? (
        <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="size-5" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <p className="text-body font-semibold text-foreground">{copy.settings.bankAccountEmptyTitle}</p>
            <p className="max-w-sm text-caption text-muted-foreground">
              {copy.settings.bankAccountEmptyDescription}
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => kyc.openDialog()}>
            {copy.kyc.menuLabel}
          </Button>
        </div>
      ) : showAddForm && accounts.length === 0 ? (
        <SettingsAddBankAccountForm
          onSuccess={() => void handleAddSuccess()}
          onCancel={() => setShowAddForm(false)}
        />
      ) : accounts.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-5">
          {actionMessage ? (
            <UiMessage variant="success" message={actionMessage} className="mt-0" />
          ) : null}
          {actionError ? <FieldMessage message={actionError} /> : null}

          <div className="space-y-3">
            {accounts.map((account) => (
              <SettingsBankAccountCard
                key={account.id}
                account={account}
                settingPrimary={settingPrimaryId === account.id}
                removing={removingId === account.id}
                onSetPrimary={handleSetPrimary}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {!canAddMore ? (
            <p className="text-caption text-muted-foreground">{copy.settings.bankAccounts.maxReached}</p>
          ) : null}

          {showAddForm ? (
            <SettingsAddBankAccountForm
              onSuccess={() => void handleAddSuccess()}
              onCancel={() => {
                setShowAddForm(false);
                setActionError("");
              }}
            />
          ) : null}
        </div>
      )}
    </SettingsContentCard>
  );
}
