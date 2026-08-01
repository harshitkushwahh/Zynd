"use client";

import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";

import { formatKycLabel } from "@/components/users/admin-user-kyc-panel-shared";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from "@/components/ui/admin-dialog";
import { AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAdminDocumentDownload } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/errors";

type AdminKycSignatureViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  hasDownload: boolean;
  filename?: string | null;
  mode?: string | null;
};

export function AdminKycSignatureViewDialog({
  open,
  onOpenChange,
  documentId,
  hasDownload,
  filename,
  mode,
}: AdminKycSignatureViewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !documentId || !hasDownload) {
      setPreviewUrl(null);
      setError("");
      setMimeType(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setPreviewUrl(null);

    void fetchAdminDocumentDownload(documentId)
      .then((payload) => {
        if (cancelled) return;
        setPreviewUrl(payload.download_url);
        setMimeType(payload.mime_type);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err, "Could not load signature."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, documentId, hasDownload]);

  const modeLabel = formatKycLabel(mode);
  const isImage = Boolean(mimeType?.startsWith("image/"));

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent size="md">
        <AdminDialogHeader
          icon={PenLine}
          title="Customer signature"
          description={
            modeLabel ? `${modeLabel} signature from KYC submission` : "Signature from KYC submission"
          }
        />
        <AdminDialogBody className="space-y-3 pt-0">
          {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
          <div className="admin-kyc-signature-view-dialog__preview">
            {loading ? (
              <Skeleton className="admin-kyc-signature-view-dialog__skeleton" />
            ) : previewUrl && isImage ? (
              <img
                src={previewUrl}
                alt={filename ?? "Customer signature"}
                className="admin-kyc-signature-view-dialog__image"
              />
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                title={filename ?? "Customer signature"}
                className="admin-kyc-signature-view-dialog__frame"
              />
            ) : !error ? (
              <p className="admin-kyc-signature-view-dialog__empty">No preview available.</p>
            ) : null}
          </div>
          {filename ? <p className="admin-kyc-signature-view-dialog__filename">{filename}</p> : null}
        </AdminDialogBody>
        <AdminDialogFooter>
          <AdminDialogFooterActions
            showCancel={false}
            confirmLabel="Close"
            onConfirm={() => onOpenChange(false)}
          />
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
}
