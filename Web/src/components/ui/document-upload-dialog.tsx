"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import { Button } from "@/components/ui/button";
import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Slider } from "@/components/ui/slider";
import { FieldMessage } from "@/components/ui/ui-message";
import { cropImageToFile } from "@/features/documents/lib/crop-image";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type FileValidationResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

export type DocumentUploadPreviewShape = "circle" | "rounded" | "contain";
export type DocumentUploadCropShape = "rect" | "round";

type DialogView = "empty" | "crop" | "preview";

export type DocumentUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  icon?: LucideIcon;
  accept: string;
  formatsHint: string;
  chooseLabel: string;
  previewAlt: string;
  onUpload: (file: File) => Promise<void>;
  prepareFile?: (file: File) => Promise<FileValidationResult> | FileValidationResult;
  dropHint?: string;
  browseLabel?: string;
  changeLabel?: string;
  submitLabel?: string;
  cancelLabel?: string;
  uploadingLabel?: string;
  uploadFailedMessage?: string;
  emptySelectionMessage?: string;
  previewShape?: DocumentUploadPreviewShape;
  disabled?: boolean;
  enableCrop?: boolean;
  cropAspect?: number;
  cropShape?: DocumentUploadCropShape;
  applyCropLabel?: string;
  croppingLabel?: string;
  hideCancel?: boolean;
  hideFooterOnEmpty?: boolean;
};

function previewRadiusClass(shape: DocumentUploadPreviewShape) {
  return shape === "circle" ? "rounded-full" : "rounded-[var(--radius-card)]";
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon = ImagePlus,
  accept,
  formatsHint,
  chooseLabel,
  previewAlt,
  onUpload,
  prepareFile,
  dropHint = copy.uploadDialog.dropHint,
  browseLabel = copy.uploadDialog.browse,
  changeLabel = copy.uploadDialog.change,
  submitLabel = copy.uploadDialog.save,
  cancelLabel = copy.uploadDialog.cancel,
  uploadingLabel = copy.uploadDialog.uploading,
  uploadFailedMessage = copy.uploadDialog.uploadFailed,
  emptySelectionMessage = copy.uploadDialog.chooseFile,
  previewShape = "rounded",
  disabled = false,
  enableCrop = false,
  cropAspect = 1,
  cropShape = "rect",
  applyCropLabel = copy.uploadDialog.applyCrop,
  croppingLabel = copy.uploadDialog.cropping,
  hideCancel = false,
  hideFooterOnEmpty = false,
}: DocumentUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const cropSourceUrlRef = useRef<string | null>(null);

  const [view, setView] = useState<DialogView>("empty");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [cropSourceName, setCropSourceName] = useState("");
  const [cropSourceMime, setCropSourceMime] = useState("image/jpeg");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isBusy = disabled || uploading || cropping;

  const revokePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const revokeCropSource = () => {
    if (cropSourceUrlRef.current) {
      URL.revokeObjectURL(cropSourceUrlRef.current);
      cropSourceUrlRef.current = null;
    }
  };

  const resetState = useCallback(() => {
    revokePreview();
    revokeCropSource();
    setView("empty");
    setPreviewUrl(null);
    setSelectedFile(null);
    setCropSourceUrl(null);
    setCropSourceName("");
    setCropSourceMime("image/jpeg");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError("");
    setUploading(false);
    setCropping(false);
    setDragOver(false);
  }, []);

  useResetWhenDialogOpens(open, resetState);

  useEffect(() => {
    return () => {
      revokePreview();
      revokeCropSource();
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const setPreviewFromFile = (file: File) => {
    revokePreview();
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setView("preview");
  };

  const enterCropStep = (file: File) => {
    revokeCropSource();
    revokePreview();
    setSelectedFile(null);
    setPreviewUrl(null);

    const nextCropUrl = URL.createObjectURL(file);
    cropSourceUrlRef.current = nextCropUrl;
    setCropSourceUrl(nextCropUrl);
    setCropSourceName(file.name.replace(/\.[^.]+$/, "") || "upload");
    setCropSourceMime(file.type.startsWith("image/") ? file.type : "image/jpeg");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setView("crop");
  };

  const handleFileSelection = async (file: File | null) => {
    if (!file || isBusy) return;

    setError("");

    let workingFile = file;
    if (prepareFile) {
      const prepared = await prepareFile(file);
      if (!prepared.ok) {
        setError(prepared.message);
        setSelectedFile(null);
        revokePreview();
        revokeCropSource();
        setPreviewUrl(null);
        setCropSourceUrl(null);
        setView("empty");
        return;
      }
      workingFile = prepared.file;
    }

    if (enableCrop) {
      enterCropStep(workingFile);
      return;
    }

    setPreviewFromFile(workingFile);
  };

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!cropSourceUrl || !croppedAreaPixels) {
      setError(emptySelectionMessage);
      return;
    }

    setCropping(true);
    setError("");
    try {
      const extension = cropSourceMime === "image/png" ? ".png" : ".jpg";
      const mimeType = cropSourceMime === "image/png" ? "image/png" : "image/jpeg";
      const croppedFile = await cropImageToFile(
        cropSourceUrl,
        croppedAreaPixels,
        `${cropSourceName}${extension}`,
        mimeType,
      );
      let finalFile = croppedFile;
      if (prepareFile) {
        const prepared = await prepareFile(croppedFile);
        if (!prepared.ok) {
          setError(prepared.message);
          return;
        }
        finalFile = prepared.file;
      }
      revokeCropSource();
      setCropSourceUrl(null);
      setPreviewFromFile(finalFile);
    } catch (cropError) {
      setError(
        cropError instanceof Error && cropError.message
          ? cropError.message
          : uploadFailedMessage,
      );
    } finally {
      setCropping(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(emptySelectionMessage);
      return;
    }

    setUploading(true);
    setError("");
    try {
      await onUpload(selectedFile);
      handleOpenChange(false);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error && uploadError.message
          ? uploadError.message
          : uploadFailedMessage,
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (isBusy) return;
    void handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  };

  const radiusClass = previewRadiusClass(previewShape);

  const previewClassName = cn(
    "relative z-[1] shadow-zynd-low ring-2 ring-border",
    previewShape === "circle" && "size-full object-cover",
    previewShape === "rounded" && "max-h-48 w-full object-cover",
    previewShape === "contain" &&
      "mx-auto max-h-48 w-full border border-border/80 bg-white object-contain p-3",
    radiusClass,
    uploading && "opacity-95",
  );

  const previewFrameClassName = cn(
    "relative mx-auto flex items-center justify-center",
    previewShape === "circle" && "size-36",
    previewShape !== "circle" &&
      "w-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted/15 p-3",
    uploading && "upload-preview-spin-ring",
    radiusClass,
  );

  const cropContainerClassName = cn(
    "relative mx-auto w-full overflow-hidden bg-muted/30",
    previewShape === "circle" ? "aspect-square max-w-[16rem]" : "aspect-[4/3] max-h-56",
    radiusClass,
  );

  const primaryDisabled =
    isBusy ||
    (view === "preview" && !selectedFile) ||
    (view === "crop" && !croppedAreaPixels);

  const primaryLabel =
    view === "crop"
      ? cropping
        ? croppingLabel
        : applyCropLabel
      : uploading
        ? uploadingLabel
        : submitLabel;

  const showFooter = !(hideFooterOnEmpty && view === "empty");

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
    >
      <div className="min-w-0 space-y-4 overflow-hidden p-6">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={isBusy}
          onChange={(event) => {
            void handleFileSelection(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />

        {view === "empty" ? (
          <div
            role="button"
            tabIndex={isBusy ? -1 : 0}
            aria-label={chooseLabel}
            aria-disabled={isBusy}
            onClick={() => {
              if (!isBusy) inputRef.current?.click();
            }}
            onKeyDown={(event) => {
              if (isBusy) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!isBusy) setDragOver(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isBusy) setDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragOver(false);
              }
            }}
            onDrop={handleDrop}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed px-5 py-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              dragOver
                ? "border-primary bg-primary/[0.08]"
                : "border-primary/30 bg-primary/[0.03] hover:border-primary/45 hover:bg-primary/[0.06]",
              isBusy && "pointer-events-none opacity-60",
            )}
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <ImagePlus className="size-6" strokeWidth={2} />
            </div>
            <div className="space-y-1.5">
              <p className="text-compact font-semibold text-foreground">{chooseLabel}</p>
              <p className="text-caption text-muted-foreground">{dropHint}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{formatsHint}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] bg-secondary px-3.5 py-1.5 text-caption font-medium text-secondary-foreground">
              <Upload className="size-3.5" />
              {browseLabel}
            </span>
          </div>
        ) : null}

        {view === "crop" && cropSourceUrl ? (
          <div className="space-y-4">
            <div className={cropContainerClassName} aria-busy={cropping}>
              <Cropper
                image={cropSourceUrl}
                crop={crop}
                zoom={zoom}
                aspect={cropAspect}
                cropShape={cropShape}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <Slider
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              disabled={isBusy}
              onValueChange={(value) => setZoom(Array.isArray(value) ? value[0] : value)}
              aria-label="Zoom"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
            >
              {changeLabel}
            </Button>
          </div>
        ) : null}

        {view === "preview" && previewUrl ? (
          <div className="space-y-4">
            <div
              className={previewFrameClassName}
              aria-busy={uploading}
              aria-live={uploading ? "polite" : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={previewAlt} className={previewClassName} />
            </div>

            <div className="min-w-0 rounded-[var(--radius-card)] border border-border bg-muted/20 px-4 py-3">
              <p
                className="min-w-0 truncate text-center text-caption font-medium text-foreground"
                title={selectedFile?.name}
              >
                {selectedFile?.name}
              </p>
              <p className="mt-1 text-center text-[11px] text-muted-foreground">{formatsHint}</p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
            >
              {changeLabel}
            </Button>
          </div>
        ) : null}

        {error ? <FieldMessage message={error} className="mt-0" /> : null}

        {showFooter ? (
          <BrandDialogFooter className={cn("-mx-6 -mb-6", hideCancel && "sm:justify-end")}>
            {!hideCancel ? (
              <Button
                type="button"
                variant="outline"
                className="sm:min-w-[7rem]"
                disabled={isBusy}
                onClick={() => handleOpenChange(false)}
              >
                {cancelLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              className="sm:min-w-[7rem]"
              disabled={primaryDisabled}
              onClick={() => void (view === "crop" ? handleApplyCrop() : handleUpload())}
            >
              {uploading || cropping ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {primaryLabel}
                </>
              ) : (
                primaryLabel
              )}
            </Button>
          </BrandDialogFooter>
        ) : null}
      </div>
    </BrandDialog>
  );
}
