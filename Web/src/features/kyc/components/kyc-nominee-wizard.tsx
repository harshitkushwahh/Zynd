"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycDateField } from "@/features/kyc/components/kyc-date-field";
import { KycMobileField } from "@/features/kyc/components/kyc-mobile-field";
import { KycNomineeDocumentNumberField } from "@/features/kyc/components/kyc-nominee-document-field";
import { NomineeWizardCircleProgress } from "@/features/kyc/components/kyc-nominee-wizard-progress";
import { KycSelectField } from "@/features/kyc/components/kyc-select-field";
import {
  KYC_NOMINEE_DOCUMENT_TYPE_OPTIONS,
  KYC_NOMINEE_RELATIONSHIP_OPTIONS,
  KYC_NOMINEE_SOURCE_OF_WEALTH_OPTIONS,
} from "@/features/kyc/lib/kyc-master-data-options";
import {
  createEmptyNomineeAddress,
  createEmptyNomineeContact,
  createEmptyNomineeCore,
  createEmptyNomineeDraft,
  createEmptyNomineeGuardian,
  createEmptyNomineeIdentity,
  formatNomineeDobForDateInput,
  getNomineeTypeFromDob,
  isNomineeWizardDirty,
  KYC_NOMINEE_WIZARD_STEPS,
  normalizeNomineeSharePercentInput,
  parseNomineeDob,
  type KycNomineeRecord,
  type KycNomineeWizardStep,
} from "@/features/kyc/lib/kyc-nominee";
import {
  KYC_NOMINEE_LIMITS,
  normalizeNomineeDocumentNumber,
  normalizePersonNameInput,
  validateKycNomineeAddress,
  validateKycNomineeDocument,
  validateKycNomineeEmail,
  validateKycNomineeMobile,
  validateKycPersonName,
} from "@/features/kyc/lib/kyc-nominee-validation";
import { DEFAULT_KYC_COUNTRY } from "@/features/kyc/lib/indian-states";
import type { KycMasterDataOption } from "@/features/kyc/lib/kyc-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycNomineeWizardProps = {
  existingNominees: KycNomineeRecord[];
  editingNominee?: KycNomineeRecord;
  relationshipOptions?: KycMasterDataOption[];
  sourceOfWealthOptions?: KycMasterDataOption[];
  documentTypeOptions?: KycMasterDataOption[];
  onCancel: (hasUnsavedContent: boolean) => void;
  onSave: (nominee: KycNomineeRecord) => void;
};

type WizardPhase = "core" | "steps";

type ErrorMap = Partial<Record<string, string>>;

function getWizardStepLabel(step: KycNomineeWizardStep) {
  return copy.kyc.nominee.wizardSteps[step];
}

function validateCore(
  core: ReturnType<typeof createEmptyNomineeCore>,
  existingNominees: KycNomineeRecord[],
  editingId?: string,
) {
  const errors: ErrorMap = {};

  const fullNameError = validateKycPersonName(core.fullName);
  if (fullNameError) errors.fullName = fullNameError;

  if (!core.relationship) errors.relationship = copy.kyc.nominee.requiredField;
  if (!core.sourceOfWealth) errors.sourceOfWealth = copy.kyc.nominee.requiredField;
  if (!core.dateOfBirth.trim()) {
    errors.dateOfBirth = copy.kyc.nominee.requiredField;
  } else if (!parseNomineeDob(core.dateOfBirth)) {
    errors.dateOfBirth = copy.kyc.nominee.invalidDob;
  }
  if (!core.sharePercent.trim()) {
    errors.sharePercent = copy.kyc.nominee.requiredField;
  } else {
    const share = Number(core.sharePercent);
    if (!Number.isFinite(share) || share < 1 || share > 100) {
      errors.sharePercent = copy.kyc.nominee.invalidShare;
    } else {
      const otherShare = existingNominees
        .filter((nominee) => nominee.id !== editingId)
        .reduce((total, nominee) => total + Number(nominee.core.sharePercent), 0);
      if (otherShare + share > 100) {
        errors.sharePercent = copy.kyc.nominee.shareExceedsTotal;
      }
    }
  }

  return errors;
}

function validateWizardStep(
  step: KycNomineeWizardStep,
  draft: ReturnType<typeof createEmptyNomineeDraft>,
) {
  const errors: ErrorMap = {};

  if (step === "basic") {
    if (draft.type === "minor" && draft.guardian) {
      const guardianNameError = validateKycPersonName(draft.guardian.name);
      if (guardianNameError) errors.guardianName = guardianNameError;
      if (!draft.guardian.sourceOfWealth) {
        errors.guardianSourceOfWealth = copy.kyc.nominee.requiredField;
      }
      if (!draft.guardian.documentType) {
        errors.guardianDocumentType = copy.kyc.nominee.requiredField;
      } else {
        const guardianDocumentError = validateKycNomineeDocument(
          draft.guardian.documentType,
          draft.guardian.documentNumber,
        );
        if (guardianDocumentError) {
          errors.guardianDocumentNumber = guardianDocumentError;
        }
      }
    } else {
      if (!draft.identity.documentType) {
        errors.documentType = copy.kyc.nominee.requiredField;
      } else {
        const documentError = validateKycNomineeDocument(
          draft.identity.documentType,
          draft.identity.documentNumber,
        );
        if (documentError) {
          errors.documentNumber = documentError;
        }
      }
    }
  }

  if (step === "contact") {
    if (draft.type === "minor" && draft.guardian) {
      const guardianEmailError = validateKycNomineeEmail(draft.guardian.email);
      if (guardianEmailError) errors.guardianEmail = guardianEmailError;
      const guardianMobileError = validateKycNomineeMobile(draft.guardian.mobile);
      if (guardianMobileError) errors.guardianMobile = guardianMobileError;
    } else {
      const emailError = validateKycNomineeEmail(draft.contact.email);
      if (emailError) errors.email = emailError;
      const mobileError = validateKycNomineeMobile(draft.contact.mobile);
      if (mobileError) errors.mobile = mobileError;
    }
  }

  if (step === "address") {
    Object.assign(errors, validateKycNomineeAddress(draft.address));
  }

  return errors;
}

function NomineeWizardStepIndicator({
  activeStep,
}: {
  activeStep: KycNomineeWizardStep;
}) {
  const activeIndex = KYC_NOMINEE_WIZARD_STEPS.indexOf(activeStep);

  return (
    <div className="flex items-center gap-1.5">
      {KYC_NOMINEE_WIZARD_STEPS.map((step, index) => {
        const isActive = step === activeStep;
        const isComplete = index < activeIndex;

        return (
          <div
            key={step}
            className={cn(
              "flex items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-1 text-[11px] font-medium transition-colors",
              isActive
                ? "bg-foreground text-background"
                : isComplete
                  ? "bg-muted text-foreground"
                  : "bg-muted/40 text-muted-foreground",
            )}
          >
            <span>{index + 1}</span>
            <span>{getWizardStepLabel(step)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function KycNomineeWizard({
  existingNominees,
  editingNominee,
  relationshipOptions,
  sourceOfWealthOptions,
  documentTypeOptions,
  onCancel,
  onSave,
}: KycNomineeWizardProps) {
  const relationshipSelectOptions = useMemo(
    () => relationshipOptions ?? KYC_NOMINEE_RELATIONSHIP_OPTIONS,
    [relationshipOptions],
  );
  const sourceOfWealthSelectOptions = useMemo(
    () => sourceOfWealthOptions ?? KYC_NOMINEE_SOURCE_OF_WEALTH_OPTIONS,
    [sourceOfWealthOptions],
  );
  const documentTypeSelectOptions = useMemo(
    () => documentTypeOptions ?? KYC_NOMINEE_DOCUMENT_TYPE_OPTIONS,
    [documentTypeOptions],
  );
  const [phase, setPhase] = useState<WizardPhase>(editingNominee ? "steps" : "core");
  const [activeStep, setActiveStep] = useState<KycNomineeWizardStep>("basic");
  const [core, setCore] = useState(() => editingNominee?.core ?? createEmptyNomineeCore());
  const [draft, setDraft] = useState(() => {
    if (editingNominee) return editingNominee;
    const type = getNomineeTypeFromDob(core.dateOfBirth);
    return createEmptyNomineeDraft(type);
  });
  const [errors, setErrors] = useState<ErrorMap>({});

  const nomineeType = useMemo(
    () => draft.type ?? getNomineeTypeFromDob(core.dateOfBirth),
    [core.dateOfBirth, draft.type],
  );

  const maxDateOfBirth = useMemo(() => formatNomineeDobForDateInput(
    `${String(new Date().getDate()).padStart(2, "0")}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${new Date().getFullYear()}`,
  ), []);

  const updateCore = (field: keyof typeof core, value: string) => {
    const nextValue =
      field === "fullName" ? normalizePersonNameInput(value) : value;
    const nextCore = {
      ...core,
      [field]: nextValue,
    };
    setCore(nextCore);
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateDraft = (section: "identity" | "contact" | "address" | "guardian", field: string, value: string) => {
    setDraft((current) => {
      if (section === "guardian") {
        const guardianValue = current.guardian ?? createEmptyNomineeGuardian();
        const nextValue =
          field === "name"
            ? normalizePersonNameInput(value)
            : field === "documentNumber"
              ? normalizeNomineeDocumentNumber(guardianValue.documentType, value)
              : value;
        return {
          ...current,
          guardian: {
            ...guardianValue,
            [field]: nextValue,
          },
        };
      }

      if (section === "address") {
        const addressValue = current.address ?? createEmptyNomineeAddress();
        const nextValue =
          field === "line1"
            ? value.slice(0, KYC_NOMINEE_LIMITS.addressLine1.max)
            : field === "line2"
              ? value.slice(0, KYC_NOMINEE_LIMITS.addressLine2.max)
              : field === "city"
                ? value.slice(0, KYC_NOMINEE_LIMITS.city.max)
                : value;
        return {
          ...current,
          address: {
            ...addressValue,
            [field]: nextValue,
            country: DEFAULT_KYC_COUNTRY,
          },
        };
      }

      if (section === "identity" && field === "documentNumber") {
        const identityValue = current.identity ?? createEmptyNomineeIdentity();
        return {
          ...current,
          identity: {
            ...identityValue,
            documentNumber: normalizeNomineeDocumentNumber(identityValue.documentType, value),
          },
        };
      }

      const sectionValue = current[section];
      if (!sectionValue || typeof sectionValue !== "object") return current;

      return {
        ...current,
        [section]: {
          ...sectionValue,
          [field]: value,
        },
      };
    });
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleCoreNext = () => {
    const nextErrors = validateCore(core, existingNominees, editingNominee?.id);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const type = getNomineeTypeFromDob(core.dateOfBirth);
    setDraft((current) => ({
      ...current,
      type,
      core,
      guardian: type === "minor" ? current.guardian ?? createEmptyNomineeGuardian() : undefined,
      identity: current.identity ?? createEmptyNomineeIdentity(),
      contact: current.contact ?? createEmptyNomineeContact(),
      address: current.address ?? createEmptyNomineeAddress(),
    }));
    setPhase("steps");
    setActiveStep("basic");
    setErrors({});
  };

  const handleWizardNext = () => {
    const nextErrors = validateWizardStep(activeStep, { ...draft, core, type: nomineeType });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const stepIndex = KYC_NOMINEE_WIZARD_STEPS.indexOf(activeStep);
    if (stepIndex < KYC_NOMINEE_WIZARD_STEPS.length - 1) {
      setActiveStep(KYC_NOMINEE_WIZARD_STEPS[stepIndex + 1]);
      setErrors({});
      return;
    }

    onSave({
      id: editingNominee?.id ?? crypto.randomUUID(),
      type: nomineeType,
      core,
      identity: draft.identity,
      contact: draft.contact,
      address: draft.address,
      guardian: draft.guardian,
    });
  };

  const handleWizardBack = () => {
    const stepIndex = KYC_NOMINEE_WIZARD_STEPS.indexOf(activeStep);
    if (stepIndex > 0) {
      setActiveStep(KYC_NOMINEE_WIZARD_STEPS[stepIndex - 1]);
      setErrors({});
      return;
    }
    setPhase("core");
    setErrors({});
  };

  const handleCancel = () => {
    onCancel(
      isNomineeWizardDirty(
        {
          type: nomineeType,
          core,
          identity: draft.identity,
          contact: draft.contact,
          address: draft.address,
          guardian: draft.guardian,
        },
        editingNominee,
      ),
    );
  };

  if (phase === "core") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={copy.kyc.nominee.back}
            >
              <ArrowLeft className="size-4" />
            </button>
            <h3 className="truncate text-body font-semibold text-foreground">
              {copy.kyc.nominee.addNomineeTitle}
            </h3>
          </div>
          <NomineeWizardCircleProgress step={0} />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nominee-full-name">{copy.kyc.nominee.fields.fullName} *</Label>
            <Input
              id="nominee-full-name"
              value={core.fullName}
              onChange={(event) => updateCore("fullName", event.target.value)}
              placeholder={copy.kyc.nominee.placeholders.fullName}
              maxLength={KYC_NOMINEE_LIMITS.fullName.max}
              aria-invalid={Boolean(errors.fullName)}
            />
            {errors.fullName ? <FieldMessage message={errors.fullName} /> : null}
          </div>

          <KycSelectField
            id="nominee-relationship"
            label={`${copy.kyc.nominee.fields.relationship} *`}
            value={core.relationship}
            options={relationshipSelectOptions}
            placeholder={copy.kyc.nominee.placeholders.select}
            hasError={Boolean(errors.relationship)}
            onChange={(value) => updateCore("relationship", value)}
          />
          {errors.relationship ? <FieldMessage message={errors.relationship} /> : null}

          <KycSelectField
            id="nominee-source-of-wealth"
            label={`${copy.kyc.nominee.fields.sourceOfWealth} *`}
            value={core.sourceOfWealth}
            options={sourceOfWealthSelectOptions}
            placeholder={copy.kyc.nominee.placeholders.select}
            hasError={Boolean(errors.sourceOfWealth)}
            onChange={(value) => updateCore("sourceOfWealth", value)}
          />
          {errors.sourceOfWealth ? <FieldMessage message={errors.sourceOfWealth} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <KycDateField
                id="nominee-dob"
                label={`${copy.kyc.nominee.fields.dateOfBirth} *`}
                value={core.dateOfBirth}
                max={maxDateOfBirth}
                hasError={Boolean(errors.dateOfBirth)}
                onChange={(value) => updateCore("dateOfBirth", value)}
              />
              {errors.dateOfBirth ? <FieldMessage message={errors.dateOfBirth} /> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nominee-share">{copy.kyc.nominee.fields.sharePercent} *</Label>
              <Input
                id="nominee-share"
                inputMode="numeric"
                value={core.sharePercent}
                onChange={(event) =>
                  updateCore("sharePercent", normalizeNomineeSharePercentInput(event.target.value))
                }
                placeholder={copy.kyc.nominee.placeholders.sharePercent}
                aria-invalid={Boolean(errors.sharePercent)}
              />
              {errors.sharePercent ? <FieldMessage message={errors.sharePercent} /> : null}
            </div>
          </div>
        </div>

        <Button type="button" size="lg" className="w-full" onClick={handleCoreNext}>
          {copy.kyc.nominee.next}
        </Button>
      </div>
    );
  }

  const guardian = draft.guardian ?? createEmptyNomineeGuardian();

  const activeStepIndex = KYC_NOMINEE_WIZARD_STEPS.indexOf(activeStep);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={handleWizardBack}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={copy.kyc.nominee.back}
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="min-w-0">
              <h3 className="truncate text-body font-semibold text-foreground">
                {copy.kyc.nominee.addNomineeTitle}
              </h3>
              <p className="text-caption text-muted-foreground">
                {nomineeType === "minor"
                  ? copy.kyc.nominee.types.minor
                  : copy.kyc.nominee.types.individual}
              </p>
            </div>
          </div>
          <NomineeWizardCircleProgress step={activeStepIndex + 1} />
        </div>
        <NomineeWizardStepIndicator activeStep={activeStep} />
      </div>

      <div className="space-y-4">
        {activeStep === "basic" && nomineeType === "minor" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="guardian-name">{copy.kyc.nominee.fields.guardianName} *</Label>
              <Input
                id="guardian-name"
                value={guardian.name}
                onChange={(event) => updateDraft("guardian", "name", event.target.value)}
                placeholder={copy.kyc.nominee.placeholders.guardianName}
                aria-invalid={Boolean(errors.guardianName)}
              />
              {errors.guardianName ? <FieldMessage message={errors.guardianName} /> : null}
            </div>

            <KycSelectField
              id="guardian-document-type"
              label={`${copy.kyc.nominee.fields.documentType} *`}
              value={guardian.documentType}
              options={documentTypeSelectOptions}
              placeholder={copy.kyc.nominee.placeholders.select}
              hasError={Boolean(errors.guardianDocumentType)}
              onChange={(value) => {
                setDraft((current) => {
                  const guardianValue = current.guardian ?? createEmptyNomineeGuardian();
                  return {
                    ...current,
                    guardian: {
                      ...guardianValue,
                      documentType: value,
                      documentNumber: "",
                    },
                  };
                });
                setErrors((current) => ({
                  ...current,
                  guardianDocumentType: undefined,
                  guardianDocumentNumber: undefined,
                }));
              }}
            />
            {errors.guardianDocumentType ? <FieldMessage message={errors.guardianDocumentType} /> : null}

            <KycSelectField
              id="guardian-source-of-wealth"
              label={`${copy.kyc.nominee.fields.guardianSourceOfWealth} *`}
              value={guardian.sourceOfWealth}
              options={sourceOfWealthSelectOptions}
              placeholder={copy.kyc.nominee.placeholders.select}
              hasError={Boolean(errors.guardianSourceOfWealth)}
              onChange={(value) => updateDraft("guardian", "sourceOfWealth", value)}
            />
            {errors.guardianSourceOfWealth ? (
              <FieldMessage message={errors.guardianSourceOfWealth} />
            ) : null}

            <KycNomineeDocumentNumberField
              id="guardian-document-number"
              documentType={guardian.documentType}
              value={guardian.documentNumber}
              error={errors.guardianDocumentNumber}
              onChange={(value) => updateDraft("guardian", "documentNumber", value)}
              onErrorChange={(message) =>
                setErrors((current) => ({ ...current, guardianDocumentNumber: message }))
              }
            />
          </>
        ) : null}

        {activeStep === "basic" && nomineeType === "individual" ? (
          <>
            <KycSelectField
              id="nominee-document-type"
              label={`${copy.kyc.nominee.fields.documentType} *`}
              value={draft.identity.documentType}
              options={documentTypeSelectOptions}
              placeholder={copy.kyc.nominee.placeholders.select}
              hasError={Boolean(errors.documentType)}
              onChange={(value) => {
                setDraft((current) => ({
                  ...current,
                  identity: {
                    ...current.identity,
                    documentType: value,
                    documentNumber: "",
                  },
                }));
                setErrors((current) => ({
                  ...current,
                  documentType: undefined,
                  documentNumber: undefined,
                }));
              }}
            />
            {errors.documentType ? <FieldMessage message={errors.documentType} /> : null}

            <KycNomineeDocumentNumberField
              id="nominee-document-number"
              documentType={draft.identity.documentType}
              value={draft.identity.documentNumber}
              error={errors.documentNumber}
              onChange={(value) => updateDraft("identity", "documentNumber", value)}
              onErrorChange={(message) =>
                setErrors((current) => ({ ...current, documentNumber: message }))
              }
            />
          </>
        ) : null}

        {activeStep === "contact" && nomineeType === "minor" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="guardian-email">{copy.kyc.nominee.fields.guardianEmail} *</Label>
              <Input
                id="guardian-email"
                type="email"
                value={guardian.email}
                onChange={(event) => updateDraft("guardian", "email", event.target.value)}
                placeholder={copy.kyc.nominee.placeholders.email}
                aria-invalid={Boolean(errors.guardianEmail)}
              />
              {errors.guardianEmail ? <FieldMessage message={errors.guardianEmail} /> : null}
            </div>

            <KycMobileField
              id="guardian-mobile"
              label={`${copy.kyc.nominee.fields.guardianMobile} *`}
              value={guardian.mobile}
              placeholder={copy.kyc.nominee.placeholders.mobile}
              hasError={Boolean(errors.guardianMobile)}
              onChange={(value) => updateDraft("guardian", "mobile", value)}
            />
            {errors.guardianMobile ? <FieldMessage message={errors.guardianMobile} /> : null}
          </>
        ) : null}

        {activeStep === "contact" && nomineeType === "individual" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="nominee-email-contact">{copy.kyc.nominee.fields.email} *</Label>
              <Input
                id="nominee-email-contact"
                type="email"
                value={draft.contact.email}
                onChange={(event) => updateDraft("contact", "email", event.target.value)}
                placeholder={copy.kyc.nominee.placeholders.email}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email ? <FieldMessage message={errors.email} /> : null}
            </div>

            <KycMobileField
              id="nominee-mobile-contact"
              label={`${copy.kyc.nominee.fields.mobile} *`}
              value={draft.contact.mobile}
              placeholder={copy.kyc.nominee.placeholders.mobile}
              hasError={Boolean(errors.mobile)}
              onChange={(value) => updateDraft("contact", "mobile", value)}
            />
            {errors.mobile ? <FieldMessage message={errors.mobile} /> : null}
          </>
        ) : null}

        {activeStep === "address" ? (
          <>
            <p className="text-compact font-medium text-foreground">
              {copy.kyc.nominee.fields.nomineeAddress} *
            </p>

            <div className="space-y-2">
              <Label htmlFor="nominee-address-line1">{copy.kyc.nominee.fields.addressLine1}</Label>
              <Input
                id="nominee-address-line1"
                value={draft.address.line1}
                onChange={(event) => updateDraft("address", "line1", event.target.value)}
                placeholder={copy.kyc.nominee.placeholders.addressLine1}
                maxLength={KYC_NOMINEE_LIMITS.addressLine1.max}
                aria-invalid={Boolean(errors.line1)}
              />
              {errors.line1 ? <FieldMessage message={errors.line1} /> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nominee-address-line2">{copy.kyc.nominee.fields.addressLine2}</Label>
              <Input
                id="nominee-address-line2"
                value={draft.address.line2}
                onChange={(event) => updateDraft("address", "line2", event.target.value)}
                placeholder={copy.kyc.nominee.placeholders.addressLine2}
                maxLength={KYC_NOMINEE_LIMITS.addressLine2.max}
                aria-invalid={Boolean(errors.line2)}
              />
              {errors.line2 ? <FieldMessage message={errors.line2} /> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nominee-city">{copy.kyc.nominee.fields.city}</Label>
                <Input
                  id="nominee-city"
                  value={draft.address.city}
                  onChange={(event) => updateDraft("address", "city", event.target.value)}
                  placeholder={copy.kyc.nominee.placeholders.city}
                  maxLength={KYC_NOMINEE_LIMITS.city.max}
                  aria-invalid={Boolean(errors.city)}
                />
                {errors.city ? <FieldMessage message={errors.city} /> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nominee-pincode">{copy.kyc.nominee.fields.pincode}</Label>
                <Input
                  id="nominee-pincode"
                  inputMode="numeric"
                  value={draft.address.pincode}
                  onChange={(event) =>
                    updateDraft("address", "pincode", event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder={copy.kyc.nominee.placeholders.pincode}
                  aria-invalid={Boolean(errors.pincode)}
                />
                {errors.pincode ? <FieldMessage message={errors.pincode} /> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nominee-country">{copy.kyc.nominee.fields.country}</Label>
              <Input
                id="nominee-country"
                value={draft.address.country || DEFAULT_KYC_COUNTRY}
                disabled
                readOnly
                aria-readonly="true"
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
          {copy.kyc.nominee.cancel}
        </Button>
        <Button type="button" className="flex-1" onClick={handleWizardNext}>
          {activeStep === "address" ? copy.kyc.nominee.saveNominee : copy.kyc.nominee.next}
        </Button>
      </div>
    </div>
  );
}
