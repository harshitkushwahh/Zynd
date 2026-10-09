"use client";

import { useState } from "react";
import { Plus, Trash2, UserPlus, UserRound, UsersRound } from "lucide-react";

import { AddSettingsNomineeDialog } from "@/components/dashboard/settings/add-settings-nominee-dialog";
import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import { SettingsPanelHeader } from "@/components/dashboard/settings/settings-panel-header";
import { SETTINGS_NAV } from "@/components/dashboard/settings/settings-sidebar";
import { NomineesPanelSkeleton } from "@/components/dashboard/settings/settings-skeleton";
import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { useKycOptional } from "@/contexts/kyc-context";
import { addInvestorNominee } from "@/features/kyc/lib/kyc-api";
import {
  KYC_NOMINEE_RELATIONSHIP_OPTIONS,
  lookupKycEnumLabel,
} from "@/features/kyc/lib/kyc-master-data-options";
import {
  assignLeftoverShareAfterRemove,
  formatNomineeDobDisplay,
  MAX_KYC_NOMINEES,
  type KycNomineeRecord,
} from "@/features/kyc/lib/kyc-nominee";
import type { SettingsKycProfile } from "@/features/kyc/lib/settings-kyc-profile";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type NomineesSettingsPanelProps = {
  kycProfile?: SettingsKycProfile | null;
  kycProfileLoading?: boolean;
  onKycProfileReload?: () => Promise<void> | void;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function SettingsNomineeCard({
  nominee,
  canRemove,
  removing,
  onRemove,
}: {
  nominee: KycNomineeRecord;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-gradient-to-br from-card via-card to-muted/15 p-4 shadow-zynd-low">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/15">
          <UserRound className="size-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-body font-semibold text-foreground">{nominee.core.fullName}</p>
            <StatusBadge variant="neutral" showIcon={false} className="h-5 px-2 text-[10px]">
              {lookupKycEnumLabel(nominee.core.relationship, KYC_NOMINEE_RELATIONSHIP_OPTIONS)}
            </StatusBadge>
          </div>
          <p className="mt-1 text-caption text-muted-foreground">
            {nominee.type === "minor" ? copy.kyc.nominee.types.minor : copy.kyc.nominee.types.individual}
            {nominee.core.dateOfBirth ? ` · ${formatNomineeDobDisplay(nominee.core.dateOfBirth)}` : ""}
          </p>
        </div>
        {canRemove ? (
          <TooltipProvider>
            <IconActionButton
              label={copy.settings.removeNominee}
              icon={Trash2}
              destructive
              disabled={removing}
              loading={removing}
              onClick={onRemove}
            />
          </TooltipProvider>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-[var(--radius-control)] border border-border/60 bg-muted/25 px-3 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          {copy.kyc.nominee.fields.sharePercent}
        </span>
        <span className="text-caption font-semibold text-foreground">
          {copy.kyc.nominee.list.shareLabel(nominee.core.sharePercent)}
        </span>
      </div>
    </div>
  );
}

export function NomineesSettingsPanel({
  kycProfile,
  kycProfileLoading = false,
  onKycProfileReload,
}: NomineesSettingsPanelProps) {
  const sectionMeta = SETTINGS_NAV.find((item) => item.id === "nominees")!;
  const kyc = useKycOptional();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const nominees = kycProfile?.nominees ?? [];
  const maxNominees = kycProfile?.maxNominees ?? MAX_KYC_NOMINEES;
  const canAdd = Boolean(kycProfile?.canAddNominee) && nominees.length < maxNominees;

  const handleSaveNominee = async (nomineesToSave: KycNomineeRecord[]) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await addInvestorNominee(nomineesToSave);
      await onKycProfileReload?.();
      setAddOpen(false);
      setSuccess(copy.settings.nomineeAdded);
    } catch (err) {
      setError(getErrorMessage(err, copy.settings.couldNotAddNominee));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveNominee = async (nomineeId: string) => {
    await handleSaveNominee(assignLeftoverShareAfterRemove(nominees, nomineeId));
  };

  const headerActions =
    kycProfile?.kycVerified && kycProfile.canAddNominee ? (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!canAdd}
        onClick={() => {
          if (!canAdd) return;
          setAddOpen(true);
        }}
      >
        <Plus className="mr-1.5 size-4" />
        {copy.settings.nomineesAddCta}
      </Button>
    ) : null;

  const renderGateState = (title: string, description: string, showKycCta: boolean) => (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UsersRound className="size-5" strokeWidth={2} />
      </div>
      <div className="space-y-1">
        <p className="text-body font-semibold text-foreground">{title}</p>
        <p className="max-w-sm text-caption text-muted-foreground">{description}</p>
      </div>
      {showKycCta && kyc?.kycAllowed ? (
        <Button type="button" size="sm" onClick={() => kyc.openDialog()}>
          {copy.kyc.menuLabel}
        </Button>
      ) : null}
    </div>
  );

  const renderBody = () => {
    if (kycProfileLoading) {
      return <NomineesPanelSkeleton />;
    }

    if (!kycProfile?.kycVerified) {
      return renderGateState(
        copy.settings.nomineesKycRequiredTitle,
        copy.settings.nomineesKycRequiredDescription,
        Boolean(kyc?.kycAllowed),
      );
    }

    if (!kycProfile.canAddNominee && nominees.length === 0) {
      return renderGateState(
        copy.settings.nomineesNotReadyTitle,
        copy.settings.nomineesNotReadyDescription,
        false,
      );
    }

    if (nominees.length === 0) {
      return (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className={cn(
            "group flex w-full flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-primary/30 bg-primary/[0.03] px-6 py-10 text-center transition-colors",
            "hover:border-primary/45 hover:bg-primary/[0.06]",
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 transition-transform group-hover:scale-105">
            <UserPlus className="size-5" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <p className="text-body font-semibold text-foreground">{copy.settings.nomineesEmptyTitle}</p>
            <p className="max-w-sm text-caption leading-relaxed text-muted-foreground">
              {copy.settings.nomineesEmptyDescription}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] bg-foreground px-3 py-1.5 text-[11px] font-medium text-background">
            <Plus className="size-3.5" />
            {copy.settings.nomineesAddCta}
          </span>
        </button>
      );
    }

    return (
      <div className="space-y-5">
        {success ? <UiMessage variant="success" message={success} className="mt-0" /> : null}
        {error && !addOpen ? <FieldMessage message={error} /> : null}

        <div className="space-y-3">
          {nominees.map((nominee) => (
            <SettingsNomineeCard
              key={nominee.id}
              nominee={nominee}
              canRemove={Boolean(kycProfile.canAddNominee)}
              removing={saving}
              onRemove={() => void handleRemoveNominee(nominee.id)}
            />
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {copy.settings.nomineesFolioDisclaimer}
        </p>
      </div>
    );
  };

  return (
    <SettingsContentCard
      header={
        <SettingsPanelHeader
          icon={sectionMeta.icon}
          title={sectionMeta.title}
          description={sectionMeta.description}
          actions={headerActions}
        />
      }
    >
      {renderBody()}

      <AddSettingsNomineeDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setError("");
        }}
        existingNominees={nominees}
        investorPanLast4={kycProfile?.panLast4}
        saving={saving}
        error={error}
        onSave={(nomineesToSave) => void handleSaveNominee(nomineesToSave)}
      />
    </SettingsContentCard>
  );
}
