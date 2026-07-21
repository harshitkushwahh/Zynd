"use client";

import { Camera } from "lucide-react";

import { DocumentUploadDialog } from "@/components/ui/document-upload-dialog";
import { uploadFamilyGroupAvatar } from "@/features/family-groups/api/family-groups-api";
import { formatDocumentUploadError } from "@/features/documents/lib/format-document-upload-error";
import {
  prepareProfileImageFile,
  PROFILE_IMAGE_ACCEPT,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_DIMENSION,
  PROFILE_IMAGE_MIN_DIMENSION,
} from "@/features/documents/lib/profile-image";
import { copy } from "@/shared/config/copy";

type FamilyGroupAvatarUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onUploaded?: (avatarUrl: string | null) => void;
};

export function FamilyGroupAvatarUploadDialog({
  open,
  onOpenChange,
  groupId,
  onUploaded,
}: FamilyGroupAvatarUploadDialogProps) {
  const maxMb = Math.round(PROFILE_IMAGE_MAX_BYTES / (1024 * 1024));
  const avatarCopy = copy.familyGroups.avatarUpload;

  return (
    <DocumentUploadDialog
      open={open}
      onOpenChange={onOpenChange}
      title={avatarCopy.title}
      description={avatarCopy.description}
      icon={Camera}
      accept={PROFILE_IMAGE_ACCEPT}
      formatsHint={avatarCopy.formats(
        maxMb,
        PROFILE_IMAGE_MIN_DIMENSION,
        PROFILE_IMAGE_MAX_DIMENSION,
      )}
      chooseLabel={avatarCopy.choosePhoto}
      dropHint={avatarCopy.dropHint}
      browseLabel={avatarCopy.browse}
      changeLabel={avatarCopy.changePhoto}
      submitLabel={avatarCopy.save}
      cancelLabel={avatarCopy.cancel}
      uploadingLabel={avatarCopy.uploading}
      uploadFailedMessage={avatarCopy.uploadFailed}
      emptySelectionMessage={avatarCopy.choosePhoto}
      previewAlt={avatarCopy.previewAlt}
      previewShape="circle"
      enableCrop
      cropAspect={1}
      cropShape="round"
      prepareFile={prepareProfileImageFile}
      onUpload={async (file) => {
        try {
          const updated = await uploadFamilyGroupAvatar(groupId, file);
          onUploaded?.(updated.avatar_url ?? null);
        } catch (error) {
          throw new Error(formatDocumentUploadError(error, avatarCopy.uploadFailed));
        }
      }}
    />
  );
}
