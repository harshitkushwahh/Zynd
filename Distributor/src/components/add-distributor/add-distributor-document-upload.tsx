"use client";

import { useRef, type ChangeEvent } from "react";
import { CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ADD_DISTRIBUTOR_ACCEPTED_DOC_TYPES } from "@/lib/add-distributor/add-distributor-journey";
import { cn } from "@/lib/utils";

type AddDistributorDocumentUploadProps = {
  id: string;
  label: string;
  description: string;
  fileName: string | null;
  onFileSelect: (fileName: string | null) => void;
  uploading?: boolean;
  variant?: "default" | "wizard";
};

export function AddDistributorDocumentUpload({
  id,
  label,
  description,
  fileName,
  onFileSelect,
  uploading = false,
  variant = "default",
}: AddDistributorDocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploaded = Boolean(fileName);
  const isWizard = variant === "wizard";

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onFileSelect(file ? file.name : null);
  };

  const openPicker = () => inputRef.current?.click();

  return (
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
          <p className="add-distributor-doc__file-name">{fileName}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => {
              onFileSelect(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Replace
          </Button>
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
          {!uploaded ? (
            <span className="add-distributor-doc__dropzone-meta">No file chosen</span>
          ) : null}
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

      <p className="add-distributor-doc__hint">PDF, JPG, or PNG · max 5 MB (demo)</p>
    </div>
  );
}
