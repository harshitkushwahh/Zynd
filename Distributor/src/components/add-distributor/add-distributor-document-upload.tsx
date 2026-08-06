"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, Eye, FileUp, Loader2, Upload } from "lucide-react";

import {
  AddDistributorDocumentPreviewDialog,
  isDistributorDocumentPdf,
} from "@/components/add-distributor/add-distributor-document-preview-dialog";
import { Button } from "@/components/ui/button";
import { ADD_DISTRIBUTOR_ACCEPTED_DOC_TYPES } from "@/lib/add-distributor/add-distributor-journey";
import { cn } from "@/lib/utils";

type AddDistributorDocumentUploadProps = {
  id: string;
  label: string;
  description: string;
  fileName: string | null;
  previewUrl?: string | null;
  onFileSelect: (file: File) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  uploading?: boolean;
  variant?: "default" | "wizard";
};

export function AddDistributorDocumentUpload({
  id,
  label,
  description,
  fileName,
  previewUrl,
  onFileSelect,
  onClear,
  uploading = false,
  variant = "default",
}: AddDistributorDocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const uploaded = Boolean(fileName);
  const isWizard = variant === "wizard";
  const showPdfPreview = isDistributorDocumentPdf(fileName);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void onFileSelect(file);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <>
      <div
        className={cn(
          "add-distributor-doc",
          uploaded && "add-distributor-doc--uploaded",
          isWizard && "add-distributor-doc--wizard",
        )}
      >
        <div className="add-distributor-doc__head">
          <span className="add-distributor-doc__icon" aria-hidden>
            <FileUp className="size-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="add-distributor-doc__label">{label}</p>
            <p className="add-distributor-doc__description">{description}</p>
          </div>
          {uploaded ? (
            <CheckCircle2 className="add-distributor-doc__status-icon size-5 shrink-0" aria-hidden />
          ) : null}
        </div>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ADD_DISTRIBUTOR_ACCEPTED_DOC_TYPES}
          className="sr-only"
          onChange={handleChange}
        />

        {uploaded ? (
          <div className="add-distributor-doc__file">
            {previewUrl && !showPdfPreview ? (
              <button
                type="button"
                className="add-distributor-doc__thumb"
                onClick={() => setPreviewOpen(true)}
                aria-label={`View ${label}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="" className="add-distributor-doc__thumb-image" />
              </button>
            ) : previewUrl && showPdfPreview ? (
              <button
                type="button"
                className="add-distributor-doc__thumb add-distributor-doc__thumb--pdf"
                onClick={() => setPreviewOpen(true)}
                aria-label={`View ${label}`}
              >
                <FileUp className="size-4" aria-hidden />
              </button>
            ) : null}
            <div className="add-distributor-doc__file-meta">
              <p className="add-distributor-doc__file-name" title={fileName ?? undefined}>
                {fileName}
              </p>
              <div className="add-distributor-doc__file-actions">
                {previewUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="size-3.5" aria-hidden />
                    View
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => {
                    void onClear?.();
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  Replace
                </Button>
              </div>
            </div>
          </div>
        ) : isWizard ? (
          <button
            type="button"
            className="add-distributor-doc__dropzone"
            disabled={uploading}
            onClick={openPicker}
          >
            <Upload className="add-distributor-doc__dropzone-icon size-5" strokeWidth={2.25} aria-hidden />
            <span className="add-distributor-doc__dropzone-title">
              {uploading ? "Uploading…" : "Choose file"}
            </span>
            <span className="add-distributor-doc__dropzone-meta">No file chosen</span>
          </button>
        ) : (
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={uploading} onClick={openPicker}>
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              "Choose file"
            )}
          </Button>
        )}

        <p className="add-distributor-doc__hint">PDF, JPG, or PNG · max 5 MB</p>
      </div>

      <AddDistributorDocumentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        label={label}
        fileName={fileName}
        previewUrl={previewUrl ?? null}
      />
    </>
  );
}
