"use client";

import { useRef, type ChangeEvent } from "react";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";

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
};

export function AddDistributorDocumentUpload({
  id,
  label,
  description,
  fileName,
  onFileSelect,
  uploading = false,
}: AddDistributorDocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploaded = Boolean(fileName);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onFileSelect(file ? file.name : null);
  };

  return (
    <div
      className={cn(
        "add-distributor-doc",
        uploaded && "add-distributor-doc--uploaded",
      )}
    >
      <div className="add-distributor-doc__head">
        <span className="add-distributor-doc__icon" aria-hidden>
          <FileUp className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-compact font-medium text-foreground">{label}</p>
          <p className="text-caption text-muted-foreground">{description}</p>
        </div>
        {uploaded ? (
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
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
          <p className="truncate font-mono text-caption text-foreground">{fileName}</p>
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
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
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
