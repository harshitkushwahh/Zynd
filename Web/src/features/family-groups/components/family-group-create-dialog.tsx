"use client";

import { useCallback, useState } from "react";
import { Tag, UserPlus, Users } from "lucide-react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldMessage } from "@/components/ui/ui-message";
import type { CreateFamilyGroupInput } from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupCreateHeroImage } from "@/features/family-groups/components/family-group-create-hero-image";
import {
  hasFamilyGroupFormErrors,
  normalizeOptionalText,
  validateFamilyGroupForm,
  FAMILY_GROUP_LIMITS,
  type FamilyGroupFormFieldErrors,
} from "@/features/family-groups/lib/family-group-validation";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { cn } from "@/lib/utils";

type FamilyGroupCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateFamilyGroupInput) => Promise<void>;
  submitting?: boolean;
  error?: string;
};

type CreateDialogStep = "intro" | "form";

const CREATE_STEPS: CreateDialogStep[] = ["intro", "form"];

const CREATE_INTRO_STEP_ICONS = [Users, Tag, UserPlus] as const;

function CreateDialogProgress({ step, compact = false }: { step: CreateDialogStep; compact?: boolean }) {
  const currentIndex = CREATE_STEPS.indexOf(step);

  return (
    <div
      className={cn("flex gap-1.5", compact ? "mb-2" : "mb-5")}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={CREATE_STEPS.length}
      aria-valuenow={currentIndex + 1}
      aria-label={copy.familyGroups.createTitle}
    >
      {CREATE_STEPS.map((item, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div
            key={item}
            className={cn(
              "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
              done && "bg-success",
              active && "bg-primary",
              !done && !active && "bg-border",
            )}
          />
        );
      })}
    </div>
  );
}

function CreateIntroStep({ onContinue }: { onContinue: () => void }) {
  const createCopy = copy.familyGroups;

  return (
    <div className="space-y-5">
      <ul className="space-y-2.5">
        {createCopy.createIntroSteps.map((point, index) => {
          const Icon = CREATE_INTRO_STEP_ICONS[index] ?? Users;
          return (
            <li key={point} className="flex items-start gap-2.5 text-[11px] leading-snug text-muted-foreground sm:text-caption">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-3" strokeWidth={2.5} aria-hidden />
              </span>
              {point}
            </li>
          );
        })}
      </ul>

      <AuthSubmitFooter className="pt-0">
        <Button type="button" className="w-full" onClick={onContinue}>
          {copy.mfa.continue}
        </Button>
      </AuthSubmitFooter>
    </div>
  );
}

export function FamilyGroupCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
  error = "",
}: FamilyGroupCreateDialogProps) {
  const [step, setStep] = useState<CreateDialogStep>("intro");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FamilyGroupFormFieldErrors>({});

  const reset = useCallback(() => {
    setStep("intro");
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

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.familyGroups.createTitle}
      maxWidth="lg"
    >
      <div className="px-5 pb-5 pt-1.5">
        <CreateDialogProgress step={step} compact={step !== "intro"} />

        {step === "intro" ? <FamilyGroupCreateHeroImage className="mb-4" /> : null}

        {step === "intro" ? (
          <CreateIntroStep onContinue={() => setStep("form")} />
        ) : (
          <form id="family-group-create-form" className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="family-group-title">{copy.familyGroups.form.titleLabel}</Label>
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
                  placeholder={copy.familyGroups.form.titlePlaceholder}
                  className="h-9 bg-background"
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
                  className="bg-background"
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
                  className="h-9 bg-background"
                  maxLength={FAMILY_GROUP_LIMITS.tagMax}
                  aria-invalid={Boolean(fieldErrors.tag)}
                />
                {fieldErrors.tag ? <FieldMessage message={fieldErrors.tag} /> : null}
              </div>
            </div>

            {error ? <FieldMessage message={error} className="mt-0" /> : null}

            <AuthSubmitFooter className="pt-1">
              <Button type="submit" className="w-full" disabled={submitting || !title.trim()}>
                {copy.familyGroups.form.submit}
              </Button>
            </AuthSubmitFooter>
          </form>
        )}
      </div>
    </BrandDialog>
  );
}
