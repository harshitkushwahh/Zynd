"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, PenLine, Trash2, Upload } from "lucide-react";

import { AddInvestorSignaturePad } from "@/components/add-investor/add-investor-signature-pad";
import { Button } from "@/components/ui/button";
import {
  ADD_INVESTOR_SIGNATURE_ACCEPT,
  ADD_INVESTOR_SIGNATURE_MAX_BYTES,
  type AddInvestorSignatureTab,
} from "@/lib/add-investor/add-investor-signature";
import { cn } from "@/lib/utils";

type AddInvestorSignaturePanelProps = {
  signatureDataUrl: string;
  signatureMode: AddInvestorSignatureTab | null;
  onSignatureChange: (dataUrl: string, mode: AddInvestorSignatureTab | null) => void;
};

const SIGNATURE_TABS: Array<{ id: AddInvestorSignatureTab; label: string; icon: typeof PenLine }> = [
  { id: "draw", label: "Draw signature", icon: PenLine },
  { id: "upload", label: "Upload image", icon: Upload },
];

export function AddInvestorSignaturePanel({
  signatureDataUrl,
  signatureMode,
  onSignatureChange,
}: AddInvestorSignaturePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<AddInvestorSignatureTab>(
    signatureMode ?? "draw",
  );
  const [drawnSignature, setDrawnSignature] = useState(
    signatureMode === "draw" ? signatureDataUrl : "",
  );
  const [uploadedSignature, setUploadedSignature] = useState(
    signatureMode === "upload" ? signatureDataUrl : "",
  );
  const [uploadFileName, setUploadFileName] = useState("");
  const [error, setError] = useState("");

  const hasSignature = signatureDataUrl.trim().length > 0;

  const handleTabChange = (tab: AddInvestorSignatureTab) => {
    setActiveTab(tab);
    setError("");
    const nextValue = tab === "draw" ? drawnSignature : uploadedSignature;
    onSignatureChange(nextValue, nextValue ? tab : null);
  };

  const handleDrawnSignatureChange = (value: string) => {
    setDrawnSignature(value);
    if (activeTab === "draw") {
      onSignatureChange(value, value ? "draw" : null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      setError("Upload a PNG or JPG image.");
      return;
    }

    if (file.size > ADD_INVESTOR_SIGNATURE_MAX_BYTES) {
      setError("Signature image must be 2 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setUploadedSignature(reader.result);
      setUploadFileName(file.name);
      setError("");
      onSignatureChange(reader.result, "upload");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveUpload = () => {
    setUploadedSignature("");
    setUploadFileName("");
    setError("");
    if (activeTab === "upload") {
      onSignatureChange("", null);
    }
  };

  return (
    <div className="add-investor-onboarding-wizard__center add-investor-signature-panel">
      <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
        <PenLine className="size-6" strokeWidth={2.25} />
      </span>
      <h3 className="add-investor-onboarding-wizard__title">Investor signature</h3>
      <p className="add-investor-signature-panel__desc">
        Draw your signature or upload a PNG/JPG file for KYC documents.
      </p>

      <div className="add-investor-signature-panel__tabs" role="tablist" aria-label="Signature method">
        {SIGNATURE_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "add-investor-signature-panel__tab",
                isActive && "add-investor-signature-panel__tab--active",
              )}
            >
              <TabIcon className="size-3.5" strokeWidth={2.1} aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="add-investor-signature-panel__body">
        {activeTab === "draw" ? (
          <div className="add-investor-signature-panel__draw">
            <p className="add-investor-signature-panel__hint">
              Sign inside the box using your mouse or trackpad.
            </p>
            <AddInvestorSignaturePad value={drawnSignature} onChange={handleDrawnSignatureChange} />
          </div>
        ) : (
          <div className="add-investor-signature-panel__upload">
            <p className="add-investor-signature-panel__hint">PNG or JPG · max 2 MB</p>

            <input
              ref={fileInputRef}
              type="file"
              accept={ADD_INVESTOR_SIGNATURE_ACCEPT}
              className="sr-only"
              onChange={handleFileChange}
            />

            {!uploadedSignature ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="add-investor-signature-panel__dropzone"
              >
                <span className="add-investor-signature-panel__dropzone-icon" aria-hidden>
                  <ImagePlus className="size-5" strokeWidth={2} />
                </span>
                <span className="add-investor-signature-panel__dropzone-title">Upload signature image</span>
                <span className="add-investor-signature-panel__dropzone-copy">
                  Choose a clear signature on white background
                </span>
                <span className="add-investor-signature-panel__dropzone-action">
                  <Upload className="size-3.5" strokeWidth={2} aria-hidden />
                  Choose file
                </span>
              </button>
            ) : (
              <div className="add-investor-signature-panel__preview-card">
                <div className="add-investor-signature-panel__preview-header">
                  <p className="add-investor-signature-panel__preview-name">{uploadFileName}</p>
                  <Button type="button" variant="outline" size="sm" onClick={handleRemoveUpload}>
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove
                  </Button>
                </div>
                <div className="add-investor-signature-panel__preview-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedSignature}
                    alt="Uploaded signature preview"
                    className="add-investor-signature-panel__preview-image"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error ? <p className="add-investor-signature-panel__error">{error}</p> : null}

      {hasSignature ? (
        <p className="add-investor-signature-panel__success">
          <CheckCircle2 className="size-3.5" strokeWidth={2.25} aria-hidden />
          Signature captured for compliance documents.
        </p>
      ) : null}
    </div>
  );
}
