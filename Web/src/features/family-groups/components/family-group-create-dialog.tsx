"use client";

import { useCallback, useState } from "react";
import { Check, FileText, Send, Tag, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SplitFormDialog } from "@/components/ui/split-form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { FieldMessage } from "@/components/ui/ui-message";
import type { CreateFamilyGroupInput } from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupCreateHeroImage } from "@/features/family-groups/components/family-group-create-hero-image";
import {
  FAMILY_GROUP_LIMITS,
  hasFamilyGroupFormErrors,
  normalizeOptionalText,
  validateFamilyGroupForm,
  type FamilyGroupFormFieldErrors,
} from "@/features/family-groups/lib/family-group-validation";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateFamilyGroupInput) => Promise<void>;
  submitting?: boolean;
  error?: string;
};

const INTRO_POINT_ICONS = [
  { icon: Users, iconClassName: "bg-primary/10 text-primary" },
  { icon: FileText, iconClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  { icon: Send, iconClassName: "bg-success/10 text-success" },
] as const;

export function FamilyGroupCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
  error = "",
}: FamilyGroupCreateDialogProps) {
  const formCopy = copy.familyGroups.form;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FamilyGroupFormFieldErrors>({});

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setTag("");
    setFieldErrors({});
  }, []);

  useResetWhenDialogOpens(open, reset);

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
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  const points = copy.familyGroups.createIntroPoints.map((point, index) => ({
    ...point,
    icon: INTRO_POINT_ICONS[index]?.icon ?? Users,
    iconClassName: INTRO_POINT_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
  }));

  return (
    <SplitFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.familyGroups.createTitle}
      illustration={<FamilyGroupCreateHeroImage className="w-full max-w-sm" />}
      points={points}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            {formCopy.cancel}
          </Button>
          <Button
            type="submit"
            form="family-group-create-form"
            className="h-11 rounded-full px-5"
            disabled={submitting || !title.trim()}
          >
            {formCopy.submit}
          </Button>
        </>
      }
    >
      <form id="family-group-create-form" className="min-w-0 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="family-group-title">
            {formCopy.titleLabel} <span className="text-destructive">*</span>
          </Label>
          <div className="relative min-w-0">
            <Users className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="family-group-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (fieldErrors.title) {
                  setFieldErrors((current) => ({
                    ...current,
                    title: validateFamilyGroupForm({
                      title: event.target.value,
                      description,
                      tag,
                    }).title,
                  }));
                }
              }}
              placeholder={formCopy.titlePlaceholder}
              className="h-11 w-full min-w-0 max-w-full bg-background pl-9"
              maxLength={FAMILY_GROUP_LIMITS.titleMax}
              required
              autoFocus
              aria-invalid={Boolean(fieldErrors.title)}
            />
          </div>
          {fieldErrors.title ? <FieldMessage message={fieldErrors.title} /> : null}
        </div>

        <div className="min-w-0 space-y-2">
          <Label htmlFor="family-group-description">
            {formCopy.descriptionLabel}{" "}
            <span className="font-normal text-muted-foreground">{formCopy.descriptionOptional}</span>
          </Label>
          <div className="relative min-w-0">
            <FileText className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
            <Textarea
              id="family-group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={formCopy.descriptionPlaceholder}
              className="field-sizing-fixed min-h-24 w-full min-w-0 max-w-full bg-background pt-2.5 pl-9"
              maxLength={FAMILY_GROUP_LIMITS.descriptionMax}
              rows={3}
              aria-invalid={Boolean(fieldErrors.description)}
            />
          </div>
          <p
            className={cn(
              "text-right text-caption tabular-nums",
              description.length > FAMILY_GROUP_LIMITS.descriptionMax * 0.85
                ? "text-warning"
                : "text-muted-foreground",
            )}
          >
            {description.length} / {FAMILY_GROUP_LIMITS.descriptionMax}
          </p>
          {fieldErrors.description ? <FieldMessage message={fieldErrors.description} /> : null}
        </div>

        <div className="min-w-0 space-y-2">
          <Label htmlFor="family-group-tag">
            {formCopy.tagLabel}{" "}
            <span className="font-normal text-muted-foreground">{formCopy.tagOptional}</span>
          </Label>
          <div className="relative min-w-0">
            <Tag className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="family-group-tag"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder={formCopy.tagPlaceholder}
              className="h-11 w-full min-w-0 max-w-full bg-background pl-9"
              maxLength={FAMILY_GROUP_LIMITS.tagMax}
              aria-invalid={Boolean(fieldErrors.tag)}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {formCopy.tagSuggestions.map((suggestion) => {
              const selected = tag.trim().toLowerCase() === suggestion.toLowerCase();
              return (
                <button
                  key={suggestion}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-caption font-medium transition-colors",
                    selected
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                  onClick={() => setTag(selected ? "" : suggestion)}
                >
                  {selected ? <Check className="size-3" strokeWidth={2.5} aria-hidden /> : null}
                  {suggestion}
                </button>
              );
            })}
          </div>
          {fieldErrors.tag ? <FieldMessage message={fieldErrors.tag} /> : null}
        </div>

        {error ? <FieldMessage message={error} className="mt-0" /> : null}
      </form>
    </SplitFormDialog>
  );
}
