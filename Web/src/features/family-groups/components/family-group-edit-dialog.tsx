"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Camera, UsersRound } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  archiveFamilyGroup,
  updateFamilyGroup,
  type FamilyGroupSummary,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupAvatarUploadDialog } from "@/features/family-groups/components/family-group-avatar-upload-dialog";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import {
  FAMILY_GROUP_LIMITS,
  hasFamilyGroupFormErrors,
  normalizeOptionalText,
  validateFamilyGroupForm,
  type FamilyGroupFormFieldErrors,
} from "@/features/family-groups/lib/family-group-validation";
import { copy } from "@/shared/config/copy";

type FamilyGroupEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: FamilyGroupSummary | null;
  onUpdated: () => void;
  onArchived?: () => void;
};

export function FamilyGroupEditDialog({
  open,
  onOpenChange,
  group,
  onUpdated,
  onArchived,
}: FamilyGroupEditDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [avatarUploadOpen, setAvatarUploadOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FamilyGroupFormFieldErrors>({});

  useEffect(() => {
    if (!group || !open) return;
    setTitle(group.title);
    setDescription(group.description ?? "");
    setTag(group.tag ?? "");
    setAvatarUrl(group.avatar_url ?? null);
    setError("");
    setFieldErrors({});
  }, [group, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError("");
      setArchiveOpen(false);
      setAvatarUploadOpen(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!group) return;

    const validation = validateFamilyGroupForm({ title, description, tag });
    setFieldErrors(validation);
    if (hasFamilyGroupFormErrors(validation)) return;

    setSaving(true);
    setError("");
    try {
      await updateFamilyGroup(group.id, {
        title: title.trim(),
        description: normalizeOptionalText(description),
        tag: normalizeOptionalText(tag),
      });
      handleOpenChange(false);
      await invalidateFamilyQueries(queryClient, group.id);
      onUpdated();
    } catch (submitError) {
      setError(resolveFamilyGroupApiError(submitError, copy.familyGroups.errors.updateFailed));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!group) return;
    setArchiving(true);
    try {
      await archiveFamilyGroup(group.id);
      setArchiveOpen(false);
      handleOpenChange(false);
      await invalidateFamilyQueries(queryClient);
      onArchived?.();
    } catch (archiveError) {
      setError(resolveFamilyGroupApiError(archiveError, copy.familyGroups.errors.archiveFailed));
      setArchiveOpen(false);
    } finally {
      setArchiving(false);
    }
  }

  if (!group) return null;

  return (
    <>
      <BrandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={copy.familyGroups.editTitle}
        maxWidth="lg"
        className="max-w-xl"
      >
        <form
          id="family-group-edit-form"
          className="px-6 py-5"
          onSubmit={(event) => void handleSave(event)}
        >
          <div className="flex justify-center pb-6">
            <div className="relative size-[5.5rem]">
              <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-2 ring-border/70 shadow-zynd-low">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  <UsersRound className="size-9" strokeWidth={1.75} />
                )}
              </div>
              <button
                type="button"
                aria-label={copy.familyGroups.avatarUpload.title}
                onClick={() => setAvatarUploadOpen(true)}
                className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-card bg-foreground text-background shadow-zynd-low transition-colors hover:bg-foreground/90"
              >
                <Camera className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="space-y-4 border-t border-border/60 pt-6">
            <div className="space-y-2">
              <Label htmlFor="edit-family-group-title">{copy.familyGroups.form.titleLabel}</Label>
              <Input
                id="edit-family-group-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={copy.familyGroups.form.titlePlaceholder}
                maxLength={FAMILY_GROUP_LIMITS.titleMax}
                required
                aria-invalid={Boolean(fieldErrors.title)}
              />
              {fieldErrors.title ? <FieldMessage message={fieldErrors.title} /> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-family-group-description">{copy.familyGroups.form.descriptionLabel}</Label>
              <Textarea
                id="edit-family-group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={copy.familyGroups.form.descriptionPlaceholder}
                maxLength={FAMILY_GROUP_LIMITS.descriptionMax}
                rows={4}
                aria-invalid={Boolean(fieldErrors.description)}
              />
              {fieldErrors.description ? (
                <FieldMessage message={fieldErrors.description} />
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-family-group-tag">{copy.familyGroups.form.tagLabel}</Label>
              <Input
                id="edit-family-group-tag"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                placeholder={copy.familyGroups.form.tagPlaceholder}
                maxLength={FAMILY_GROUP_LIMITS.tagMax}
                aria-invalid={Boolean(fieldErrors.tag)}
              />
              {fieldErrors.tag ? <FieldMessage message={fieldErrors.tag} /> : null}
            </div>

            {error ? <FieldMessage message={error} className="mt-0" /> : null}
          </div>
        </form>

        <BrandDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={copy.familyGroups.detail.archiveAction}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="size-4" strokeWidth={2} />
          </Button>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {copy.familyGroups.form.cancel}
            </Button>
            <Button type="submit" form="family-group-edit-form" disabled={saving || !title.trim()}>
              {copy.familyGroups.form.save}
            </Button>
          </div>
        </BrandDialogFooter>
      </BrandDialog>

      <FamilyGroupAvatarUploadDialog
        open={avatarUploadOpen}
        onOpenChange={setAvatarUploadOpen}
        groupId={group.id}
        onUploaded={(url) => {
          setAvatarUrl(url);
          onUpdated();
        }}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        variant="destructive"
        title={copy.familyGroups.detail.archiveConfirmTitle}
        description={copy.familyGroups.detail.archiveConfirmDescription}
        confirmLabel={copy.familyGroups.detail.archiveAction}
        loading={archiving}
        onConfirm={() => void handleArchive()}
      />
    </>
  );
}
