"use client";

import type { LucideIcon } from "lucide-react";
import { Download, FileText, IdCard, Landmark, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type {
  DistributorClientDocument,
  DistributorClientDocumentStatus,
} from "@/lib/distributor-types";
import { env } from "@/lib/env";
import { formatDistributorDate } from "@/lib/format";
import {
  DISTRIBUTOR_INSET_SECTION_BODY_CLASS,
  DISTRIBUTOR_LABEL_CAPS_TINY_CLASS,
  DISTRIBUTOR_OVERLAY_FOOTER_CLASS,
  DISTRIBUTOR_OVERLAY_HEADER_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<DistributorClientDocument["category"], LucideIcon> = {
  pan: IdCard,
  address_proof: FileText,
  bank_proof: Landmark,
  signature: PenLine,
  esign: FileText,
  kyc_form: FileText,
};

type ClientDocumentViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DistributorClientDocument | null;
  statusLabel: (status: DistributorClientDocumentStatus) => string;
  statusVariant: (status: DistributorClientDocumentStatus) => "success" | "warning" | "neutral";
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{label}</dt>
      <dd className="text-compact text-foreground">{value}</dd>
    </div>
  );
}

export function ClientDocumentViewDialog({
  open,
  onOpenChange,
  document: doc,
  statusLabel,
  statusVariant,
}: ClientDocumentViewDialogProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.documents;

  if (!doc) return null;

  const Icon = CATEGORY_ICONS[doc.category];
  const hasPreview = doc.status === "uploaded" && doc.fileName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{doc.label}</DialogTitle>
        <DialogDescription>{copy.viewDescription}</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-2xl">
        <div className={DISTRIBUTOR_OVERLAY_HEADER_CLASS}>
          <div className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/50 text-muted-foreground"
              aria-hidden
            >
              <Icon className="size-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <h2 className="text-compact font-semibold">{doc.label}</h2>
              <p className="distributor-panel-card__description">{copy.viewDescription}</p>
            </div>
          </div>
        </div>
        <div className={DISTRIBUTOR_INSET_SECTION_BODY_CLASS}>
          <div
            className={cn(
              "distributor-client-document-view-dialog__preview",
              !hasPreview && "distributor-client-document-view-dialog__preview--empty",
            )}
          >
            {hasPreview ? (
              <>
                <p className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{copy.viewPreviewLabel}</p>
                <div className="distributor-client-document-view-dialog__preview-page" aria-hidden>
                  <div className="distributor-client-document-view-dialog__preview-line distributor-client-document-view-dialog__preview-line--short" />
                  <div className="distributor-client-document-view-dialog__preview-line" />
                  <div className="distributor-client-document-view-dialog__preview-line" />
                  <div className="distributor-client-document-view-dialog__preview-line distributor-client-document-view-dialog__preview-line--medium" />
                  <div className="distributor-client-document-view-dialog__preview-line" />
                  <div className="distributor-client-document-view-dialog__preview-line distributor-client-document-view-dialog__preview-line--short" />
                </div>
                <p className="mt-2 truncate text-caption text-muted-foreground">{doc.fileName}</p>
              </>
            ) : (
              <p className="text-compact text-muted-foreground">
                {doc.status === "not_required" ? copy.viewNotRequiredBody : copy.viewMissingBody}
              </p>
            )}
          </div>
          <dl className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            <MetaRow
              label={copy.columnIdentifier}
              value={doc.identifierMasked ?? copy.identifierNone}
            />
            <MetaRow label={copy.columnFile} value={doc.fileName ?? copy.fileNone} />
            <MetaRow
              label={copy.columnUploaded}
              value={doc.uploadedAt ? formatDistributorDate(doc.uploadedAt) : copy.dateNone}
            />
            <MetaRow label={copy.columnSource} value={doc.source} />
            <div className="grid gap-0.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{copy.columnStatus}</dt>
              <dd>
                <StatusBadge variant={statusVariant(doc.status)}>
                  {statusLabel(doc.status)}
                </StatusBadge>
              </dd>
            </div>
          </dl>
        </div>
        <div className={DISTRIBUTOR_OVERLAY_FOOTER_CLASS}>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={!hasPreview || !env.useBackendClients}
          >
            <Download className="size-4" />
            {copy.download}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
