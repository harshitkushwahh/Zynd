"use client";

import { useState } from "react";
import {
  AlertTriangle,
  PencilLine,
  Plus,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { KycNomineeWizard } from "@/features/kyc/components/kyc-nominee-wizard";
import type { KycMasterDataOption } from "@/features/kyc/lib/kyc-api";
import {
  MAX_KYC_NOMINEES,
  type KycNomineeRecord,
} from "@/features/kyc/lib/kyc-nominee";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycNomineeStepProps = {
  initialNominees?: KycNomineeRecord[];
  relationshipOptions?: KycMasterDataOption[];
  sourceOfWealthOptions?: KycMasterDataOption[];
  documentTypeOptions?: KycMasterDataOption[];
  saving?: boolean;
  onSubmit: (nominees: KycNomineeRecord[]) => void;
};

type NomineeView = "list" | "add" | "edit";

function NomineeSlotIndicators({
  nominees,
  max,
}: {
  nominees: KycNomineeRecord[];
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: max }, (_, index) => {
        const nominee = nominees[index];
        const isFilled = Boolean(nominee);

        return (
          <div
            key={index}
            className={cn(
              "flex flex-1 flex-col items-center gap-1.5 rounded-[var(--radius-card)] border px-2 py-2.5 transition-colors",
              isFilled
                ? "border-border bg-card shadow-zynd-low"
                : "border-dashed border-border/70 bg-muted/15",
            )}
          >
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-full",
                isFilled
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/50 text-muted-foreground/60",
              )}
            >
              {isFilled ? (
                <UserRound className="size-3.5" strokeWidth={2} />
              ) : (
                <Plus className="size-3.5" strokeWidth={2} />
              )}
            </div>
            <span
              className={cn(
                "w-full truncate text-center text-[10px] font-medium",
                isFilled ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {isFilled ? nominee.core.fullName.split(" ")[0] : `Slot ${index + 1}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NomineeListCard({
  nominee,
  onEdit,
  onRemove,
}: {
  nominee: KycNomineeRecord;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-gradient-to-br from-card via-card to-muted/15 p-3 shadow-zynd-low">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/15">
          <UserRound className="size-4" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-caption font-semibold text-foreground">
              {nominee.core.fullName}
            </p>
            <StatusBadge variant="neutral" showIcon={false} className="h-5 px-2 text-[10px]">
              {nominee.core.relationship}
            </StatusBadge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {nominee.type === "minor"
              ? copy.kyc.nominee.types.minor
              : copy.kyc.nominee.types.individual}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={copy.kyc.nominee.editNominee}
          >
            <PencilLine className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            aria-label={copy.kyc.nominee.remove}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-[var(--radius-control)] border border-border/60 bg-muted/25 px-2.5 py-2">
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

export function KycNomineeStep({
  initialNominees = [],
  relationshipOptions,
  sourceOfWealthOptions,
  documentTypeOptions,
  saving = false,
  onSubmit,
}: KycNomineeStepProps) {
  const [nominees, setNominees] = useState<KycNomineeRecord[]>(initialNominees);
  const [view, setView] = useState<NomineeView>("list");
  const [editingNominee, setEditingNominee] = useState<KycNomineeRecord | undefined>();
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);

  const canAddMore = nominees.length < MAX_KYC_NOMINEES;

  const handleAddClick = () => {
    setEditingNominee(undefined);
    setView("add");
  };

  const handleEditClick = (nominee: KycNomineeRecord) => {
    setEditingNominee(nominee);
    setView("edit");
  };

  const handleCancelWizard = (hasUnsavedContent: boolean) => {
    setView("list");
    setEditingNominee(undefined);
    setHasUnsavedDraft(hasUnsavedContent);
  };

  const handleSaveNominee = (nominee: KycNomineeRecord) => {
    setNominees((current) => {
      const existingIndex = current.findIndex((item) => item.id === nominee.id);
      if (existingIndex >= 0) {
        return current.map((item, index) => (index === existingIndex ? nominee : item));
      }
      return [...current, nominee];
    });
    setView("list");
    setEditingNominee(undefined);
    setHasUnsavedDraft(false);
  };

  const handleRemoveNominee = (id: string) => {
    setNominees((current) => current.filter((item) => item.id !== id));
  };

  const handleContinue = () => {
    onSubmit(nominees);
  };

  if (view === "add" || view === "edit") {
    return (
      <KycNomineeWizard
        existingNominees={nominees}
        editingNominee={editingNominee}
        relationshipOptions={relationshipOptions}
        sourceOfWealthOptions={sourceOfWealthOptions}
        documentTypeOptions={documentTypeOptions}
        onCancel={handleCancelWizard}
        onSave={handleSaveNominee}
      />
    );
  }

  return (
    <div className="space-y-6">
      <NomineeSlotIndicators nominees={nominees} max={MAX_KYC_NOMINEES} />

      <div className="space-y-3">
        {nominees.map((nominee) => (
          <NomineeListCard
            key={nominee.id}
            nominee={nominee}
            onEdit={() => handleEditClick(nominee)}
            onRemove={() => handleRemoveNominee(nominee.id)}
          />
        ))}

        {nominees.length === 0 ? (
          <button
            type="button"
            onClick={handleAddClick}
            className={cn(
              "group flex w-full flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-primary/30 bg-primary/[0.03] px-5 py-8 text-center transition-colors",
              "hover:border-primary/45 hover:bg-primary/[0.06]",
            )}
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 transition-transform group-hover:scale-105">
              <UserPlus className="size-5" strokeWidth={2} />
            </div>
            <div className="space-y-1">
              <p className="text-caption font-semibold text-foreground">
                {copy.kyc.nominee.list.emptyTitle}
              </p>
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                {copy.kyc.nominee.list.emptyDescription}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] bg-foreground px-3 py-1.5 text-[11px] font-medium text-background">
              <Plus className="size-3.5" />
              {copy.kyc.nominee.addNominee}
            </span>
          </button>
        ) : canAddMore ? (
          <button
            type="button"
            onClick={handleAddClick}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-primary/30 bg-primary/[0.03] px-4 py-3.5 transition-colors",
              "hover:border-primary/45 hover:bg-primary/[0.06]",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserPlus className="size-4" strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className="text-caption font-medium text-foreground">{copy.kyc.nominee.addNominee}</p>
                <p className="text-[11px] text-muted-foreground">{copy.kyc.nominee.maxNominees}</p>
              </div>
            </div>
            <Plus className="size-4 text-primary" />
          </button>
        ) : (
          <p className="rounded-[var(--radius-card)] border border-border bg-muted/20 px-4 py-3 text-center text-caption text-muted-foreground">
            {copy.kyc.nominee.maxNominees}
          </p>
        )}
      </div>

      {hasUnsavedDraft ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-warning/30 bg-warning/10 px-4 py-3.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="size-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-caption font-semibold text-foreground">
              {copy.kyc.nominee.unsavedBannerTitle}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {copy.kyc.nominee.unsavedBanner}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={handleAddClick}>
              {copy.kyc.nominee.list.resumeAdd}
            </Button>
          </div>
        </div>
      ) : null}

      <Button type="button" size="lg" className="w-full" disabled={saving} onClick={handleContinue}>
        {copy.kyc.continue}
      </Button>
    </div>
  );
}
