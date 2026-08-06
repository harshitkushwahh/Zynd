"use client";

import { ExternalLink, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AddDistributorDocumentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  fileName: string | null;
  previewUrl: string | null;
  loading?: boolean;
};

export function isDistributorDocumentPdf(fileName: string | null): boolean {
  return (fileName ?? "").toLowerCase().endsWith(".pdf");
}

export function AddDistributorDocumentPreviewDialog({
  open,
  onOpenChange,
  label,
  fileName,
  previewUrl,
  loading = false,
}: AddDistributorDocumentPreviewDialogProps) {
  const showPdf = isDistributorDocumentPdf(fileName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="add-distributor-doc-preview-dialog max-w-3xl gap-0 overflow-hidden p-0">
        <div className="add-distributor-doc-preview-dialog__header">
          <span className="add-distributor-doc-preview-dialog__icon" aria-hidden>
            <FileText className="size-5" strokeWidth={2.1} />
          </span>
          <DialogHeader className="min-w-0 flex-1 gap-1 text-left">
            <DialogTitle className="text-base font-semibold">{label}</DialogTitle>
            <DialogDescription className="truncate font-mono text-xs">{fileName}</DialogDescription>
          </DialogHeader>
        </div>

        <div
          className={cn(
            "add-distributor-doc-preview-dialog__stage",
            loading && "add-distributor-doc-preview-dialog__stage--loading",
          )}
        >
          {loading ? (
            <div className="add-distributor-doc-preview-dialog__loading">
              <Loader2 className="size-6 animate-spin" aria-hidden />
              <p>Loading preview…</p>
            </div>
          ) : previewUrl ? (
            showPdf ? (
              <iframe
                title={`${label} preview`}
                src={previewUrl}
                className="add-distributor-doc-preview-dialog__frame"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={fileName ?? label}
                className="add-distributor-doc-preview-dialog__image"
              />
            )
          ) : (
            <p className="add-distributor-doc-preview-dialog__empty">Preview unavailable.</p>
          )}
        </div>

        {previewUrl && !loading ? (
          <div className="add-distributor-doc-preview-dialog__footer">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={previewUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Open in new tab
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
