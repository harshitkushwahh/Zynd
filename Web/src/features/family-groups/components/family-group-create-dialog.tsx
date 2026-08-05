"use client";

import { useState } from "react";
import { UsersRound } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldMessage } from "@/components/ui/ui-message";
import type { CreateFamilyGroupInput } from "@/features/family-groups/api/family-groups-api";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import {
  hasFamilyGroupFormErrors,
  normalizeOptionalText,
  validateFamilyGroupForm,
  FAMILY_GROUP_LIMITS,
  type FamilyGroupFormFieldErrors,
} from "@/features/family-groups/lib/family-group-validation";
import { copy } from "@/shared/config/copy";

type FamilyGroupCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateFamilyGroupInput) => Promise<void>;
  submitting?: boolean;
  error?: string;
};

export function FamilyGroupCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
  error = "",
}: FamilyGroupCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FamilyGroupFormFieldErrors>({});

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateFamilyGroupForm({ title, description, tag });
    setFieldErrors(validation);
    if (hasFamilyGroupFormErrors(validation)) return;

    await onSubmit({
      title: title.trim(),
      description: normalizeOptionalText(description),
      tag: normalizeOptionalText(tag),
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setTitle("");
      setDescription("");
      setTag("");
      setFieldErrors({});
    }
    onOpenChange(nextOpen);
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.familyGroups.createTitle}
      description={copy.familyGroups.createDescription}
      icon={UsersRound}
      maxWidth="md"
    >
      <form
        id="family-group-create-form"
        className="space-y-4 px-6 py-5"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="space-y-2">
          <Label htmlFor="family-group-title">{copy.familyGroups.form.titleLabel}</Label>
          <Input
            id="family-group-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (fieldErrors.title) {
                setFieldErrors((current) => ({ ...current, title: validateFamilyGroupForm({ title: event.target.value, description, tag }).title }));
              }
            }}
            placeholder={copy.familyGroups.form.titlePlaceholder}
            maxLength={FAMILY_GROUP_LIMITS.titleMax}
            required
            autoFocus
            aria-invalid={Boolean(fieldErrors.title)}
          />
          {fieldErrors.title ? <FieldMessage message={fieldErrors.title} /> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="family-group-description">{copy.familyGroups.form.descriptionLabel}</Label>
          <Textarea
            id="family-group-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={copy.familyGroups.form.descriptionPlaceholder}
            maxLength={FAMILY_GROUP_LIMITS.descriptionMax}
            rows={3}
            aria-invalid={Boolean(fieldErrors.description)}
          />
          {fieldErrors.description ? <FieldMessage message={fieldErrors.description} /> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="family-group-tag">{copy.familyGroups.form.tagLabel}</Label>
          <Input
            id="family-group-tag"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder={copy.familyGroups.form.tagPlaceholder}
            maxLength={FAMILY_GROUP_LIMITS.tagMax}
            aria-invalid={Boolean(fieldErrors.tag)}
          />
          {fieldErrors.tag ? <FieldMessage message={fieldErrors.tag} /> : null}
        </div>

        {error ? <FieldMessage message={error} className="mt-0" /> : null}
      </form>

      <BrandDialogFooter>
        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
          {copy.familyGroups.form.cancel}
        </Button>
        <Button type="submit" form="family-group-create-form" disabled={submitting || !title.trim()}>
          {copy.familyGroups.form.submit}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
