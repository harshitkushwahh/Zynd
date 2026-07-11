"use client";

import { Building2 } from "lucide-react";

import {
  SettingsDetailRow,
  SettingsDetailSection,
} from "@/components/dashboard/settings/settings-detail-row";
import { SettingsPanelHeader } from "@/components/dashboard/settings/settings-panel-header";
import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import { SETTINGS_NAV } from "@/components/dashboard/settings/settings-sidebar";
import { Button } from "@/components/ui/button";
import { useKycOptional } from "@/contexts/kyc-context";
import {
  maskAccountNumber,
  type SettingsKycBank,
} from "@/features/kyc/lib/settings-kyc-profile";
import { copy } from "@/shared/config/copy";

type BankAccountSettingsPanelProps = {
  bank: SettingsKycBank | null;
  loading?: boolean;
};

export function BankAccountSettingsPanel({ bank, loading }: BankAccountSettingsPanelProps) {
  const sectionMeta = SETTINGS_NAV.find((item) => item.id === "bank-account")!;
  const kyc = useKycOptional();

  return (
    <SettingsContentCard
      header={
        <SettingsPanelHeader
          icon={sectionMeta.icon}
          title={sectionMeta.title}
          description={sectionMeta.description}
        />
      }
    >
      {loading ? (
        <p className="text-caption text-muted-foreground">{copy.settings.profileLoading}</p>
      ) : bank ? (
        <SettingsDetailSection title={copy.settings.bankAccountSectionTitle}>
          <SettingsDetailRow
            label={copy.kyc.bank.fields.accountNumber}
            value={maskAccountNumber(bank.accountNumber)}
            mono
            verified={bank.verified}
          />
          <SettingsDetailRow
            label={copy.kyc.bank.fields.accountHolderName}
            value={bank.accountHolderName}
          />
          <SettingsDetailRow label={copy.kyc.bank.fields.accountType} value={bank.accountType} />
          <SettingsDetailRow label={copy.kyc.bank.fields.ifscCode} value={bank.ifscCode} mono />
          <SettingsDetailRow label={copy.kyc.bank.fields.bankName} value={bank.bankName} />
          <SettingsDetailRow label={copy.kyc.bank.fields.branch} value={bank.branch} />
        </SettingsDetailSection>
      ) : (
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
          {kyc?.kycAllowed ? (
            <Button type="button" size="sm" onClick={() => kyc.openDialog()}>
              {copy.kyc.menuLabel}
            </Button>
          ) : null}
        </div>
      )}
    </SettingsContentCard>
  );
}
