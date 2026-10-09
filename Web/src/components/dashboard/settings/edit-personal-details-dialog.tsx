"use client";

import { Info, Lock, PencilLine } from "lucide-react";
import { useMemo, useState } from "react";

import { EditProfileHeroImage } from "@/components/dashboard/settings/edit-profile-hero-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SplitFormDialog } from "@/components/ui/split-form-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycSelectField } from "@/features/kyc/components/kyc-select-field";
import {
  KYC_INCOME_SLAB_OPTIONS,
  KYC_MARITAL_STATUS_OPTIONS,
  KYC_PEP_OPTIONS,
} from "@/features/kyc/lib/kyc-master-data-options";
import { isMarriedMaritalStatus, type KycPersonalInfoValue } from "@/features/kyc/lib/kyc-personal-info";
import { KYC_PERSON_NAME_LIMITS, normalizePersonNameInput, validateKycPersonName } from "@/features/kyc/lib/kyc-name-validation";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";

const EDIT_PROFILE_FORM_ID = "edit-personal-details-form";

const INTRO_POINT_ICONS = [
  { icon: Lock, iconClassName: "bg-muted text-muted-foreground" },
  { icon: PencilLine, iconClassName: "bg-primary/10 text-primary" },
] as const;

type EditPersonalDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: KycPersonalInfoValue;
  loading?: boolean;
  error?: string;
  onSubmit: (value: {
    incomeSlab: string;
    pepExposed: string;
    maritalStatus: string;
    spouseName: string;
  }) => void;
};

export function EditPersonalDetailsDialog({
  open,
  onOpenChange,
  initialValue,
  loading = false,
  error = "",
  onSubmit,
}: EditPersonalDetailsDialogProps) {
  const [incomeSlab, setIncomeSlab] = useState(initialValue.incomeSlab);
  const [pepExposed, setPepExposed] = useState(initialValue.pepExposed);
  const [maritalStatus, setMaritalStatus] = useState(initialValue.maritalStatus);
  const [spouseName, setSpouseName] = useState(initialValue.spouseName);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useResetWhenDialogOpens(open, () => {
    setIncomeSlab(initialValue.incomeSlab);
    setPepExposed(initialValue.pepExposed);
    setMaritalStatus(initialValue.maritalStatus);
    setSpouseName(initialValue.spouseName);
    setFieldErrors({});
  });

  const maritalOptions = useMemo(
    () =>
      KYC_MARITAL_STATUS_OPTIONS.filter(
        (option) => !initialValue.maritalStatusLocked || isMarriedMaritalStatus(option.value),
      ),
    [initialValue.maritalStatusLocked],
  );

  const points = copy.settings.editProfileIntroPoints.map((point, index) => ({
    ...point,
    icon: INTRO_POINT_ICONS[index]?.icon ?? PencilLine,
    iconClassName: INTRO_POINT_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
  }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!incomeSlab.trim()) nextErrors.incomeSlab = copy.kyc.personalInfo.requiredField;
    if (!pepExposed.trim()) nextErrors.pepExposed = copy.kyc.personalInfo.requiredField;
    if (!maritalStatus.trim()) nextErrors.maritalStatus = copy.kyc.personalInfo.requiredField;
    if (isMarriedMaritalStatus(maritalStatus)) {
      const spouseError = validateKycPersonName(
        spouseName,
        copy.kyc.personalInfo.requiredField,
        copy.kyc.personalInfo.invalidSpouseName,
      );
      if (spouseError) nextErrors.spouseName = spouseError;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    onSubmit({
      incomeSlab,
      pepExposed,
      maritalStatus,
      spouseName: isMarriedMaritalStatus(maritalStatus) ? spouseName.trim() : "",
    });
  };

  return (
    <SplitFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.settings.editProfileTitle}
      illustration={<EditProfileHeroImage className="w-full max-w-sm" />}
      points={points}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {copy.settings.cancelEditProfile}
          </Button>
          <Button
            type="submit"
            form={EDIT_PROFILE_FORM_ID}
            className="h-11 rounded-full px-5"
            disabled={loading}
          >
            {loading ? copy.settings.working : copy.settings.saveProfile}
          </Button>
        </>
      }
    >
      <form id={EDIT_PROFILE_FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-compact font-semibold text-foreground">
                {copy.settings.editProfileCardTitle}
              </p>
              <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
                {copy.settings.editProfileCardDescription}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label={copy.settings.editProfileCardInfo}
              >
                <Info className="size-4" strokeWidth={2.25} aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="max-w-[16rem] text-pretty">
                {copy.settings.editProfileCardInfo}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-4">
            <KycSelectField
              id="settings-income-slab"
              label={copy.kyc.personalInfo.fields.incomeSlab}
              value={incomeSlab}
              options={KYC_INCOME_SLAB_OPTIONS}
              placeholder={copy.kyc.personalInfo.placeholders.select}
              hasError={Boolean(fieldErrors.incomeSlab)}
              required
              infoTooltip={copy.settings.editProfileFieldInfo.incomeSlab}
              onChange={setIncomeSlab}
            />
            {fieldErrors.incomeSlab ? <FieldMessage message={fieldErrors.incomeSlab} /> : null}
            <KycSelectField
              id="settings-pep"
              label={copy.kyc.personalInfo.fields.pepExposed}
              value={pepExposed}
              options={KYC_PEP_OPTIONS}
              placeholder={copy.kyc.personalInfo.placeholders.select}
              hasError={Boolean(fieldErrors.pepExposed)}
              required
              infoTooltip={copy.settings.editProfileFieldInfo.pepExposed}
              onChange={setPepExposed}
            />
            {fieldErrors.pepExposed ? <FieldMessage message={fieldErrors.pepExposed} /> : null}
            <KycSelectField
              id="settings-marital-status"
              label={copy.kyc.personalInfo.fields.maritalStatus}
              value={maritalStatus}
              options={maritalOptions}
              placeholder={copy.kyc.personalInfo.placeholders.select}
              hasError={Boolean(fieldErrors.maritalStatus)}
              required
              disabled={Boolean(initialValue.maritalStatusLocked)}
              infoTooltip={copy.settings.editProfileFieldInfo.maritalStatus}
              onChange={(value) => {
                setMaritalStatus(value);
                if (!isMarriedMaritalStatus(value)) setSpouseName("");
              }}
            />
            {fieldErrors.maritalStatus ? <FieldMessage message={fieldErrors.maritalStatus} /> : null}
            {isMarriedMaritalStatus(maritalStatus) ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="settings-spouse-name">{copy.kyc.personalInfo.fields.spouseName}</Label>
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`About ${copy.kyc.personalInfo.fields.spouseName}`}
                    >
                      <Info className="size-3.5" strokeWidth={2.25} aria-hidden />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[16rem] text-pretty">
                      {copy.settings.editProfileFieldInfo.spouseName}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="settings-spouse-name"
                  value={spouseName}
                  maxLength={KYC_PERSON_NAME_LIMITS.max}
                  onChange={(event) => setSpouseName(normalizePersonNameInput(event.target.value))}
                  placeholder={copy.kyc.personalInfo.placeholders.spouseName}
                  aria-invalid={Boolean(fieldErrors.spouseName)}
                />
                {fieldErrors.spouseName ? <FieldMessage message={fieldErrors.spouseName} /> : null}
              </div>
            ) : null}
          </div>
        </div>
        {error ? <FieldMessage message={error} /> : null}
      </form>
    </SplitFormDialog>
  );
}
