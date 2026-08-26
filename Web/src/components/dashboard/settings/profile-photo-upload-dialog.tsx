"use client";

import { Camera } from "lucide-react";

import { DocumentUploadDialog } from "@/components/ui/document-upload-dialog";
import {
  fetchProfileImageUrl,
  uploadDocument,
  waitForDocumentReady,
} from "@/features/documents/api/documents-api";
import { formatDocumentUploadError } from "@/features/documents/lib/format-document-upload-error";
import {
  prepareProfileImageFile,
  PROFILE_IMAGE_ACCEPT,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_DIMENSION,
  PROFILE_IMAGE_MIN_DIMENSION,
} from "@/features/documents/lib/profile-image";
import { copy } from "@/shared/config/copy";

type ProfilePhotoUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: (url: string) => void;
};

export function ProfilePhotoUploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: ProfilePhotoUploadDialogProps) {
  const maxMb = Math.round(PROFILE_IMAGE_MAX_BYTES / (1024 * 1024));

  return (
    <DocumentUploadDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.profilePhoto.title}
      description={copy.profilePhoto.description}
      icon={Camera}
      accept={PROFILE_IMAGE_ACCEPT}
      formatsHint={copy.profilePhoto.formats(
        maxMb,
        PROFILE_IMAGE_MIN_DIMENSION,
        PROFILE_IMAGE_MAX_DIMENSION,
      )}
      chooseLabel={copy.profilePhoto.choosePhoto}
      dropHint={copy.profilePhoto.dropHint}
      browseLabel={copy.profilePhoto.browse}
      changeLabel={copy.profilePhoto.changePhoto}
      submitLabel={copy.profilePhoto.save}
      uploadingLabel={copy.profilePhoto.uploading}
      uploadFailedMessage={copy.profilePhoto.uploadFailed}
      emptySelectionMessage={copy.profilePhoto.choosePhoto}
      previewAlt={copy.profilePhoto.previewAlt}
      previewShape="circle"
      hideCancel
      hideFooterOnEmpty
      enableCrop
      cropAspect={1}
      cropShape="round"
      prepareFile={prepareProfileImageFile}
      onUpload={async (file) => {
        try {
          const uploaded = await uploadDocument("profile_image", file);
          await waitForDocumentReady(uploaded.id);
          const url = await fetchProfileImageUrl();
          if (url) {
            onUploaded?.(url);
          }
        } catch (error) {
          throw new Error(formatDocumentUploadError(error, copy.profilePhoto.uploadFailed));
        }
      }}
    />
  );
}
