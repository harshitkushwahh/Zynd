"use client";

import { CircleAlert, PencilLine, Percent, UserRound, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { AddNomineeHeroImage } from "@/components/dashboard/settings/add-nominee-hero-image";
import { Button } from "@/components/ui/button";
import { SplitFormDialog } from "@/components/ui/split-form-dialog";
import { SplitFormStepProgress, type SplitFormStepItem } from "@/components/ui/split-form-step-progress";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import {
  KycNomineeWizard,
  type KycNomineeWizardHandle,
} from "@/features/kyc/components/kyc-nominee-wizard";
import {
  cloneKycNominee,
  getTotalNomineeShare,
  MAX_KYC_NOMINEES,
  type KycNomineeKind,
  type KycNomineeRecord,
} from "@/features/kyc/lib/kyc-nominee";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { cn } from "@/lib/utils";

const INTRO_POINT_ICONS = [
  { icon: CircleAlert, iconClassName: "bg-warning/10 text-warning" },
  { icon: Percent, iconClassName: "bg-success/10 text-success" },
] as const;

const NOMINEE_KIND_BADGE: Record<KycNomineeKind, { label: string; variant: StatusBadgeVariant }> = {
  unknown: { label: copy.kyc.nominee.types.unknown, variant: "neutral" },
  individual: { label: copy.kyc.nominee.types.individual, variant: "info" },
  minor: { label: copy.kyc.nominee.types.minor, variant: "warning" },
};

const NOMINEE_DIALOG_STEPS: SplitFormStepItem[] = [
  { step: 1, label: copy.settings.nomineesStepDetails },
  { step: 2, label: copy.kyc.nominee.wizardSteps.basic },
  { step: 3, label: copy.kyc.nominee.wizardSteps.contact },
  { step: 4, label: copy.kyc.nominee.wizardSteps.address },
];

type AddSettingsNomineeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNominees: KycNomineeRecord[];
  investorPanLast4?: string | null;
  saving?: boolean;
  error?: string;
  onSave: (nominees: KycNomineeRecord[]) => void;
};

export function AddSettingsNomineeDialog({
  open,
  onOpenChange,
  existingNominees,
  investorPanLast4 = null,
  saving = false,
  error = "",
  onSave,
}: AddSettingsNomineeDialogProps) {
  const wizardRef = useRef<KycNomineeWizardHandle>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [primaryLabel, setPrimaryLabel] = useState<string>(copy.kyc.nominee.next);
  const [currentStep, setCurrentStep] = useState(1);
  const [nomineeKind, setNomineeKind] = useState<KycNomineeKind>("unknown");
  const [draftNominees, setDraftNominees] = useState<KycNomineeRecord[]>([]);
  const [editingNominee, setEditingNominee] = useState<KycNomineeRecord | undefined>();
  const [localHint, setLocalHint] = useState("");

  useResetWhenDialogOpens(open, () => {
    const nextDraft = existingNominees.map(cloneKycNominee);
    setWizardKey((current) => current + 1);
    setPrimaryLabel(copy.kyc.nominee.next);
    setCurrentStep(1);
    setNomineeKind("unknown");
    setDraftNominees(nextDraft);
    setEditingNominee(undefined);
    const leftover = Math.max(0, 100 - getTotalNomineeShare(nextDraft));
    setLocalHint(
      nextDraft.length > 0 && leftover === 0 && nextDraft.length < MAX_KYC_NOMINEES
        ? copy.settings.nomineesReduceShareToAdd
        : "",
    );
  });

  const remaining = Math.max(0, 100 - getTotalNomineeShare(draftNominees));
  const canAddAnother = draftNominees.length < MAX_KYC_NOMINEES && remaining > 0;
  const showWizard = Boolean(editingNominee) || canAddAnother;

  const points = copy.settings.nomineesAddIntroPoints.map((point, index) => ({
    ...point,
    icon: INTRO_POINT_ICONS[index]?.icon ?? CircleAlert,
    iconClassName: INTRO_POINT_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
  }));

  const handlePrimaryLabelChange = useCallback((label: string) => {
    setPrimaryLabel(label);
  }, []);

  const handleProgressChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const handleKindChange = useCallback((kind: KycNomineeKind) => {
    setNomineeKind(kind);
  }, []);

  const resetWizard = (nextEditing?: KycNomineeRecord) => {
    setEditingNominee(nextEditing);
    setWizardKey((current) => current + 1);
    setPrimaryLabel(copy.kyc.nominee.next);
    setCurrentStep(nextEditing ? 2 : 1);
    setNomineeKind("unknown");
  };

  const handleWizardSave = (nominee: KycNomineeRecord) => {
    const nextDraft = editingNominee
      ? draftNominees.map((item) => (item.id === nominee.id ? nominee : item))
      : [...draftNominees, nominee];
    const total = getTotalNomineeShare(nextDraft);
    const leftover = Math.max(0, 100 - total);

    setDraftNominees(nextDraft);
    setLocalHint("");

    if (total === 100) {
      setEditingNominee(undefined);
      onSave(nextDraft);
      return;
    }

    if (nextDraft.length >= MAX_KYC_NOMINEES) {
      setEditingNominee(undefined);
      setLocalHint(copy.settings.nomineesMustTotalBeforeSave);
      resetWizard();
      return;
    }

    setLocalHint(copy.settings.nomineesSavedLocally(nominee.core.fullName, leftover));
    resetWizard();
  };

  const handleEditPending = (nominee: KycNomineeRecord) => {
    setLocalHint("");
    resetWizard(nominee);
  };

  const handleRemovePending = (id: string) => {
    setDraftNominees((current) => current.filter((item) => item.id !== id));
    setLocalHint("");
    if (editingNominee?.id === id) {
      resetWizard();
    }
  };

  const kindBadge = NOMINEE_KIND_BADGE[nomineeKind];

  return (
    <SplitFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.settings.nomineesAddTitle}
      illustration={<AddNomineeHeroImage className="w-full max-w-sm" />}
      points={points}
      pointsLead={
        <StatusBadge variant={kindBadge.variant} showIcon={false} className="h-6 px-2.5 text-[11px]">
          {kindBadge.label}
        </StatusBadge>
      }
      rightHeader={<SplitFormStepProgress steps={NOMINEE_DIALOG_STEPS} currentStep={currentStep} />}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full px-5"
              disabled={saving}
              onClick={() => wizardRef.current?.back()}
            >
              {copy.kyc.nominee.back}
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full px-5"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {copy.settings.cancelEditProfile}
            </Button>
            {showWizard ? (
              <Button
                type="button"
                className="h-11 rounded-full px-5"
                disabled={saving}
                onClick={() => wizardRef.current?.advance()}
              >
                {saving ? copy.settings.working : primaryLabel}
              </Button>
            ) : remaining === 0 && draftNominees.length > 0 ? (
              <Button
                type="button"
                className="h-11 rounded-full px-5"
                disabled={saving}
                onClick={() => onSave(draftNominees)}
              >
                {saving ? copy.settings.working : copy.kyc.nominee.saveNominee}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {error ? <FieldMessage message={error} /> : null}
        {localHint ? <UiMessage variant="info" message={localHint} className="mt-0" /> : null}

        {draftNominees.length > 0 ? (
          <div className="space-y-2">
            {draftNominees.map((nominee) => {
              const isEditing = editingNominee?.id === nominee.id;
              return (
                <div
                  key={nominee.id}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-card)] border px-3 py-2.5",
                    isEditing ? "border-primary/40 bg-primary/[0.06]" : "border-border bg-muted/20",
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="size-3.5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-caption font-semibold text-foreground">{nominee.core.fullName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {copy.kyc.nominee.list.shareLabel(nominee.core.sharePercent)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={saving || isEditing}
                    onClick={() => handleEditPending(nominee)}
                    className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                    aria-label={copy.kyc.nominee.editNominee}
                  >
                    <PencilLine className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemovePending(nominee.id)}
                    className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    aria-label={copy.kyc.nominee.remove}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        {showWizard ? (
          <fieldset disabled={saving} className={cn("min-w-0", saving && "pointer-events-none opacity-70")}>
            <KycNomineeWizard
              key={wizardKey}
              ref={wizardRef}
              existingNominees={draftNominees}
              editingNominee={editingNominee}
              investorPanLast4={investorPanLast4}
              hideOuterTitle
              hideFooter
              onPrimaryLabelChange={handlePrimaryLabelChange}
              onProgressChange={handleProgressChange}
              onKindChange={handleKindChange}
              onCancel={() => onOpenChange(false)}
              onSave={handleWizardSave}
            />
          </fieldset>
        ) : null}
      </div>
    </SplitFormDialog>
  );
}
