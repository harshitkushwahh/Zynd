"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ADD_INVESTOR_NOMINEE_DOCUMENT_TYPES,
  ADD_INVESTOR_NOMINEE_RELATIONSHIPS,
  ADD_INVESTOR_NOMINEE_SOURCE_OF_WEALTH,
  ADD_INVESTOR_NOMINEE_WIZARD_STEPS,
  createEmptyNomineeAddress,
  createEmptyNomineeContact,
  createEmptyNomineeCore,
  createEmptyNomineeDraft,
  createEmptyNomineeGuardian,
  createEmptyNomineeIdentity,
  equalNomineeSharePercent,
  getNomineeTypeFromAge,
  isAddInvestorNomineeAddressValid,
  normalizeNomineeAgeInput,
  normalizeNomineeShareInput,
  parseNomineeAge,
  type AddInvestorNomineeRecord,
  type AddInvestorNomineeWizardStep,
} from "@/lib/add-investor/add-investor-nominee";
import { normalizeMobileInput } from "@/lib/add-investor/add-investor-demo";
import { cn } from "@/lib/utils";

type AddInvestorNomineeWizardProps = {
  existingNominees: AddInvestorNomineeRecord[];
  editingNominee?: AddInvestorNomineeRecord;
  onCancel: () => void;
  onSave: (nominee: AddInvestorNomineeRecord) => void;
};

type ErrorMap = Partial<Record<string, string>>;

const WIZARD_STEP_LABELS: Record<AddInvestorNomineeWizardStep, string> = {
  details: "Details",
  contact: "Contact",
  address: "Address",
};

function getWizardStepLabel(
  step: AddInvestorNomineeWizardStep,
  nomineeType: ReturnType<typeof getNomineeTypeFromAge>,
) {
  if (step === "contact" && nomineeType === "minor") {
    return "Guardian";
  }
  return WIZARD_STEP_LABELS[step];
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getWizardSteps() {
  return ADD_INVESTOR_NOMINEE_WIZARD_STEPS;
}

function validateDetailsStep(
  core: ReturnType<typeof createEmptyNomineeCore>,
  type: ReturnType<typeof getNomineeTypeFromAge>,
  existingNominees: AddInvestorNomineeRecord[],
  editingId?: string,
) {
  const errors: ErrorMap = {};

  if (core.fullName.trim().length < 2) {
    errors.fullName = "Enter nominee name";
  }
  if (parseNomineeAge(core.age) === null) {
    errors.age = "Enter a valid age";
  }
  if (!core.relationship) {
    errors.relationship = "Select relationship";
  }
  if (!core.sharePercent.trim()) {
    errors.sharePercent = "Enter share percentage";
  } else {
    const share = Number(core.sharePercent);
    if (!Number.isFinite(share) || share < 1 || share > 100) {
      errors.sharePercent = "Share must be between 1 and 100";
    } else {
      const otherShare = existingNominees
        .filter((nominee) => nominee.id !== editingId)
        .reduce((total, nominee) => total + Number(nominee.core.sharePercent), 0);
      if (otherShare + share > 100) {
        errors.sharePercent = "Total share cannot exceed 100%";
      }
    }
  }
  if (type === "adult" && !core.sourceOfWealth) {
    errors.sourceOfWealth = "Select source of wealth";
  }

  return errors;
}

function validateContactStep(
  contact: ReturnType<typeof createEmptyNomineeContact>,
  identity: ReturnType<typeof createEmptyNomineeIdentity>,
) {
  const errors: ErrorMap = {};

  if (!isValidEmail(contact.email)) {
    errors.email = "Enter a valid email";
  }
  if (contact.mobile.replace(/\D/g, "").length !== 10) {
    errors.mobile = "Enter a valid 10-digit mobile";
  }
  if (!identity.documentType) {
    errors.documentType = "Select document type";
  }
  if (identity.documentNumber.trim().length < 3) {
    errors.documentNumber = "Enter document number";
  }

  return errors;
}

function validateGuardianStep(guardian: ReturnType<typeof createEmptyNomineeGuardian>) {
  const errors: ErrorMap = {};

  if (guardian.name.trim().length < 2) {
    errors.guardianName = "Enter guardian name";
  }
  if (!isValidEmail(guardian.email)) {
    errors.guardianEmail = "Enter a valid email";
  }
  if (guardian.mobile.replace(/\D/g, "").length !== 10) {
    errors.guardianMobile = "Enter a valid 10-digit mobile";
  }
  if (!guardian.documentType) {
    errors.guardianDocumentType = "Select document type";
  }
  if (guardian.documentNumber.trim().length < 3) {
    errors.guardianDocumentNumber = "Enter document number";
  }
  if (!guardian.sourceOfWealth) {
    errors.guardianSourceOfWealth = "Select source of wealth";
  }

  return errors;
}

function NomineeWizardSteps({
  activeStep,
  nomineeType,
}: {
  activeStep: AddInvestorNomineeWizardStep;
  nomineeType: ReturnType<typeof getNomineeTypeFromAge>;
}) {
  const steps = getWizardSteps();
  const activeIndex = steps.indexOf(activeStep);

  return (
    <div className="add-investor-nominee-wizard__steps" aria-label="Nominee wizard progress">
      {steps.map((step, index) => {
        const isActive = step === activeStep;
        const isComplete = index < activeIndex;
        return (
          <div
            key={step}
            className={cn(
              "add-investor-nominee-wizard__step-pill",
              isActive && "add-investor-nominee-wizard__step-pill--active",
              isComplete && "add-investor-nominee-wizard__step-pill--complete",
            )}
          >
            <span>{index + 1}</span>
            <span>{getWizardStepLabel(step, nomineeType)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AddInvestorNomineeWizard({
  existingNominees,
  editingNominee,
  onCancel,
  onSave,
}: AddInvestorNomineeWizardProps) {
  const initialShare = useMemo(() => {
    if (editingNominee) return editingNominee.core.sharePercent;
    const nextCount = existingNominees.length + 1;
    return equalNomineeSharePercent(nextCount, nextCount - 1);
  }, [editingNominee, existingNominees.length]);

  const [activeStep, setActiveStep] = useState<AddInvestorNomineeWizardStep>("details");
  const [draft, setDraft] = useState(() => {
    if (editingNominee) return editingNominee;
    const empty = createEmptyNomineeDraft("adult");
    return {
      id: "",
      ...empty,
      core: {
        ...empty.core,
        sharePercent: initialShare,
      },
    };
  });
  const [errors, setErrors] = useState<ErrorMap>({});

  const nomineeType = getNomineeTypeFromAge(draft.core.age);
  const guardian = draft.guardian ?? createEmptyNomineeGuardian();
  const contact = draft.contact ?? createEmptyNomineeContact();
  const identity = draft.identity ?? createEmptyNomineeIdentity();
  const addressTitle =
    nomineeType === "minor" ? "Guardian address" : "Nominee address";

  const updateCore = (field: keyof typeof draft.core, value: string) => {
    const nextCore = {
      ...draft.core,
      [field]:
        field === "age"
          ? normalizeNomineeAgeInput(value)
          : field === "sharePercent"
            ? normalizeNomineeShareInput(value)
            : value,
    };
    const nextType = getNomineeTypeFromAge(nextCore.age);
    setDraft((current) => ({
      ...current,
      type: nextType,
      core: nextCore,
      contact: current.contact ?? createEmptyNomineeContact(),
      identity: current.identity ?? createEmptyNomineeIdentity(),
      guardian: nextType === "minor" ? current.guardian ?? createEmptyNomineeGuardian() : undefined,
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateContact = (field: keyof typeof contact, value: string) => {
    const nextValue = field === "mobile" ? normalizeMobileInput(value) : value;
    setDraft((current) => ({
      ...current,
      contact: {
        ...(current.contact ?? createEmptyNomineeContact()),
        [field]: nextValue,
      },
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateIdentity = (field: keyof typeof identity, value: string) => {
    setDraft((current) => ({
      ...current,
      identity: {
        ...(current.identity ?? createEmptyNomineeIdentity()),
        [field]: value,
      },
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateGuardian = (field: keyof typeof guardian, value: string) => {
    const nextValue = field === "mobile" ? normalizeMobileInput(value) : value;
    const errorKeyMap: Partial<Record<keyof typeof guardian, string>> = {
      name: "guardianName",
      email: "guardianEmail",
      mobile: "guardianMobile",
      documentType: "guardianDocumentType",
      documentNumber: "guardianDocumentNumber",
      sourceOfWealth: "guardianSourceOfWealth",
    };
    setDraft((current) => ({
      ...current,
      guardian: {
        ...(current.guardian ?? createEmptyNomineeGuardian()),
        [field]: nextValue,
      },
    }));
    setErrors((current) => ({ ...current, [errorKeyMap[field] ?? field]: undefined }));
  };

  const updateAddress = (field: keyof typeof draft.address, value: string) => {
    setDraft((current) => ({
      ...current,
      address: {
        ...(current.address ?? createEmptyNomineeAddress()),
        [field]: field === "pincode" ? value.replace(/\D/g, "").slice(0, 6) : value,
        country: current.address?.country || "India",
      },
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleNext = () => {
    if (activeStep === "details") {
      const nextErrors = validateDetailsStep(
        draft.core,
        nomineeType,
        existingNominees,
        editingNominee?.id,
      );
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }
      setDraft((current) => ({
        ...current,
        type: nomineeType,
        contact: current.contact ?? createEmptyNomineeContact(),
        identity: current.identity ?? createEmptyNomineeIdentity(),
        guardian: nomineeType === "minor" ? current.guardian ?? createEmptyNomineeGuardian() : undefined,
      }));
      setActiveStep("contact");
      setErrors({});
      return;
    }

    if (activeStep === "contact") {
      const nextErrors =
        nomineeType === "minor"
          ? validateGuardianStep(guardian)
          : validateContactStep(contact, identity);
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }
      setActiveStep("address");
      setErrors({});
      return;
    }

    if (!isAddInvestorNomineeAddressValid(draft.address)) {
      setErrors({
        line1: draft.address.line1.trim().length <= 2 ? "Enter address line 1" : undefined,
        city: draft.address.city.trim().length <= 1 ? "Enter city" : undefined,
        state: draft.address.state.trim().length <= 1 ? "Enter state" : undefined,
        pincode: draft.address.pincode.length !== 6 ? "Enter 6-digit PIN code" : undefined,
      });
      return;
    }

    onSave({
      ...draft,
      id: editingNominee?.id ?? crypto.randomUUID(),
      type: nomineeType,
      contact,
      identity,
      address: { ...draft.address, country: draft.address.country || "India" },
    });
  };

  const handleBack = () => {
    if (activeStep === "address") {
      setActiveStep("contact");
      setErrors({});
      return;
    }
    if (activeStep === "contact") {
      setActiveStep("details");
      setErrors({});
      return;
    }
    onCancel();
  };

  const nextLabel = activeStep === "address" ? "Save nominee" : "Next";

  return (
    <div className="add-investor-nominee-wizard">
      <div className="add-investor-nominee-wizard__header">
        <h3 className="add-investor-nominee-wizard__title">
          {editingNominee ? "Edit nominee" : "Add nominee"}
        </h3>
      </div>

      <div className="add-investor-nominee-wizard__steps-bar">
        <NomineeWizardSteps activeStep={activeStep} nomineeType={nomineeType} />
        {parseNomineeAge(draft.core.age) !== null ? (
          <StatusBadge variant={nomineeType === "minor" ? "warning" : "neutral"}>
            {nomineeType === "minor" ? "Minor" : "Adult"}
          </StatusBadge>
        ) : null}
      </div>

      {activeStep === "details" ? (
        <FieldGroup className="add-investor-nominee-wizard__fields">
          <Field>
            <FieldLabel htmlFor="add-investor-nominee-name">Nominee name</FieldLabel>
            <Input
              id="add-investor-nominee-name"
              value={draft.core.fullName}
              onChange={(event) => updateCore("fullName", event.target.value)}
              placeholder="Full legal name"
            />
            {errors.fullName ? <p className="text-caption text-destructive">{errors.fullName}</p> : null}
          </Field>

          <div className="add-investor-nominee-wizard__row">
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-age">Age</FieldLabel>
              <Input
                id="add-investor-nominee-age"
                inputMode="numeric"
                value={draft.core.age}
                onChange={(event) => updateCore("age", event.target.value)}
                placeholder="Years"
              />
              {errors.age ? <p className="text-caption text-destructive">{errors.age}</p> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-share">Share (%)</FieldLabel>
              <Input
                id="add-investor-nominee-share"
                inputMode="numeric"
                value={draft.core.sharePercent}
                onChange={(event) => updateCore("sharePercent", event.target.value)}
                placeholder="Share"
              />
              {errors.sharePercent ? (
                <p className="text-caption text-destructive">{errors.sharePercent}</p>
              ) : null}
            </Field>
          </div>

          {nomineeType === "adult" ? (
            <div className="add-investor-nominee-wizard__row">
              <Field>
                <FieldLabel htmlFor="add-investor-nominee-relationship">Relationship</FieldLabel>
                <Select
                  value={draft.core.relationship}
                  onValueChange={(value) => updateCore("relationship", value ?? "")}
                >
                  <SelectTrigger id="add-investor-nominee-relationship" className="w-full">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADD_INVESTOR_NOMINEE_RELATIONSHIPS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.relationship ? (
                  <p className="text-caption text-destructive">{errors.relationship}</p>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="add-investor-nominee-wealth">Source of wealth</FieldLabel>
                <Select
                  value={draft.core.sourceOfWealth}
                  onValueChange={(value) => updateCore("sourceOfWealth", value ?? "")}
                >
                  <SelectTrigger id="add-investor-nominee-wealth" className="w-full">
                    <SelectValue placeholder="Select source of wealth" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADD_INVESTOR_NOMINEE_SOURCE_OF_WEALTH.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sourceOfWealth ? (
                  <p className="text-caption text-destructive">{errors.sourceOfWealth}</p>
                ) : null}
              </Field>
            </div>
          ) : (
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-relationship">Relationship</FieldLabel>
              <Select
                value={draft.core.relationship}
                onValueChange={(value) => updateCore("relationship", value ?? "")}
              >
                <SelectTrigger id="add-investor-nominee-relationship" className="w-full">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {ADD_INVESTOR_NOMINEE_RELATIONSHIPS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.relationship ? (
                <p className="text-caption text-destructive">{errors.relationship}</p>
              ) : null}
            </Field>
          )}
        </FieldGroup>
      ) : null}

      {activeStep === "contact" && nomineeType === "adult" ? (
        <FieldGroup className="add-investor-nominee-wizard__fields">
          <p className="add-investor-nominee-wizard__section-label">Nominee contact & identity</p>
          <div className="add-investor-nominee-wizard__row">
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-email">Nominee email</FieldLabel>
              <Input
                id="add-investor-nominee-email"
                type="email"
                value={contact.email}
                onChange={(event) => updateContact("email", event.target.value)}
                placeholder="name@email.com"
              />
              {errors.email ? <p className="text-caption text-destructive">{errors.email}</p> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-mobile">Nominee mobile</FieldLabel>
              <Input
                id="add-investor-nominee-mobile"
                inputMode="numeric"
                value={contact.mobile}
                onChange={(event) => updateContact("mobile", event.target.value)}
                placeholder="10-digit mobile"
              />
              {errors.mobile ? <p className="text-caption text-destructive">{errors.mobile}</p> : null}
            </Field>
          </div>
          <div className="add-investor-nominee-wizard__row">
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-doc-type">Document type</FieldLabel>
              <Select
                value={identity.documentType}
                onValueChange={(value) => {
                  updateIdentity("documentType", value ?? "");
                  updateIdentity("documentNumber", "");
                }}
              >
                <SelectTrigger id="add-investor-nominee-doc-type" className="w-full">
                  <SelectValue placeholder="Select document" />
                </SelectTrigger>
                <SelectContent>
                  {ADD_INVESTOR_NOMINEE_DOCUMENT_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.documentType ? (
                <p className="text-caption text-destructive">{errors.documentType}</p>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-doc-number">Document number</FieldLabel>
              <Input
                id="add-investor-nominee-doc-number"
                value={identity.documentNumber}
                onChange={(event) => updateIdentity("documentNumber", event.target.value)}
                placeholder="Enter document number"
              />
              {errors.documentNumber ? (
                <p className="text-caption text-destructive">{errors.documentNumber}</p>
              ) : null}
            </Field>
          </div>
        </FieldGroup>
      ) : null}

      {activeStep === "contact" && nomineeType === "minor" ? (
        <FieldGroup className="add-investor-nominee-wizard__fields">
          <p className="add-investor-nominee-wizard__section-label">Guardian details</p>
          <Field>
            <FieldLabel htmlFor="add-investor-guardian-name">Guardian name</FieldLabel>
            <Input
              id="add-investor-guardian-name"
              value={guardian.name}
              onChange={(event) => updateGuardian("name", event.target.value)}
              placeholder="Full legal name"
            />
            {errors.guardianName ? (
              <p className="text-caption text-destructive">{errors.guardianName}</p>
            ) : null}
          </Field>

          <div className="add-investor-nominee-wizard__row">
            <Field>
              <FieldLabel htmlFor="add-investor-guardian-email">Guardian email</FieldLabel>
              <Input
                id="add-investor-guardian-email"
                type="email"
                value={guardian.email}
                onChange={(event) => updateGuardian("email", event.target.value)}
                placeholder="name@email.com"
              />
              {errors.guardianEmail ? (
                <p className="text-caption text-destructive">{errors.guardianEmail}</p>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-investor-guardian-mobile">Guardian mobile</FieldLabel>
              <Input
                id="add-investor-guardian-mobile"
                inputMode="numeric"
                value={guardian.mobile}
                onChange={(event) => updateGuardian("mobile", event.target.value)}
                placeholder="10-digit mobile"
              />
              {errors.guardianMobile ? (
                <p className="text-caption text-destructive">{errors.guardianMobile}</p>
              ) : null}
            </Field>
          </div>

          <div className="add-investor-nominee-wizard__row">
            <Field>
              <FieldLabel htmlFor="add-investor-guardian-doc-type">Document type</FieldLabel>
              <Select
                value={guardian.documentType}
                onValueChange={(value) => {
                  updateGuardian("documentType", value ?? "");
                  updateGuardian("documentNumber", "");
                }}
              >
                <SelectTrigger id="add-investor-guardian-doc-type" className="w-full">
                  <SelectValue placeholder="Select document" />
                </SelectTrigger>
                <SelectContent>
                  {ADD_INVESTOR_NOMINEE_DOCUMENT_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.guardianDocumentType ? (
                <p className="text-caption text-destructive">{errors.guardianDocumentType}</p>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-investor-guardian-doc-number">Document number</FieldLabel>
              <Input
                id="add-investor-guardian-doc-number"
                value={guardian.documentNumber}
                onChange={(event) => updateGuardian("documentNumber", event.target.value)}
                placeholder="Enter document number"
              />
              {errors.guardianDocumentNumber ? (
                <p className="text-caption text-destructive">{errors.guardianDocumentNumber}</p>
              ) : null}
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="add-investor-guardian-wealth">Guardian source of wealth</FieldLabel>
            <Select
              value={guardian.sourceOfWealth}
              onValueChange={(value) => updateGuardian("sourceOfWealth", value ?? "")}
            >
              <SelectTrigger id="add-investor-guardian-wealth" className="w-full">
                <SelectValue placeholder="Select source of wealth" />
              </SelectTrigger>
              <SelectContent>
                {ADD_INVESTOR_NOMINEE_SOURCE_OF_WEALTH.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.guardianSourceOfWealth ? (
              <p className="text-caption text-destructive">{errors.guardianSourceOfWealth}</p>
            ) : null}
          </Field>
        </FieldGroup>
      ) : null}

      {activeStep === "address" ? (
        <FieldGroup className="add-investor-nominee-wizard__fields">
          <p className="add-investor-nominee-wizard__section-label">{addressTitle}</p>
          <Field>
            <FieldLabel htmlFor="add-investor-nominee-line1">Address line 1</FieldLabel>
            <Input
              id="add-investor-nominee-line1"
              value={draft.address.line1}
              onChange={(event) => updateAddress("line1", event.target.value)}
            />
            {errors.line1 ? <p className="text-caption text-destructive">{errors.line1}</p> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="add-investor-nominee-line2">Address line 2</FieldLabel>
            <Input
              id="add-investor-nominee-line2"
              value={draft.address.line2}
              onChange={(event) => updateAddress("line2", event.target.value)}
            />
          </Field>
          <div className="add-investor-nominee-wizard__row">
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-city">City</FieldLabel>
              <Input
                id="add-investor-nominee-city"
                value={draft.address.city}
                onChange={(event) => updateAddress("city", event.target.value)}
              />
              {errors.city ? <p className="text-caption text-destructive">{errors.city}</p> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-state">State</FieldLabel>
              <Input
                id="add-investor-nominee-state"
                value={draft.address.state}
                onChange={(event) => updateAddress("state", event.target.value)}
              />
              {errors.state ? <p className="text-caption text-destructive">{errors.state}</p> : null}
            </Field>
          </div>
          <div className="add-investor-nominee-wizard__row">
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-pincode">PIN code</FieldLabel>
              <Input
                id="add-investor-nominee-pincode"
                inputMode="numeric"
                value={draft.address.pincode}
                onChange={(event) => updateAddress("pincode", event.target.value)}
              />
              {errors.pincode ? <p className="text-caption text-destructive">{errors.pincode}</p> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-investor-nominee-country">Country</FieldLabel>
              <Input id="add-investor-nominee-country" value={draft.address.country} readOnly />
            </Field>
          </div>
        </FieldGroup>
      ) : null}

      <div className="add-investor-nominee-wizard__footer">
        <Button type="button" variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button type="button" onClick={handleNext}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
