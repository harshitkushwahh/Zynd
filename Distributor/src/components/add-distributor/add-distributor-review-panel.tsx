"use client";

import { Eye, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

import { formatDistributorAddressLine } from "@/components/add-distributor/add-distributor-address-panel";
import {
  AddDistributorDocumentPreviewDialog,
  isDistributorDocumentPdf,
} from "@/components/add-distributor/add-distributor-document-preview-dialog";
import { DistributorProfileAvatar } from "@/components/ui/distributor-profile-avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePartnerOnboardingDocumentPreview } from "@/hooks/use-partner-onboarding-document-preview";
import type {
  AddDistributorAddressDraft,
  AddDistributorBankDraft,
  AddDistributorDocumentDraft,
  AddDistributorNameDraft,
} from "@/lib/add-distributor/add-distributor-journey";
import { distributorBankAccountTypeLabel } from "@/lib/add-distributor/add-distributor-journey";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type AddDistributorReviewPanelProps = {
  branchLabel: string;
  email: string;
  mobile: string;
  pan: string;
  name: AddDistributorNameDraft;
  bank: AddDistributorBankDraft;
  address: AddDistributorAddressDraft;
  documents: AddDistributorDocumentDraft;
  profilePhotoPreviewUrl: string | null;
  onboardingToken: string | null;
};

function formatFullName(name: AddDistributorNameDraft): string {
  return [name.firstName, name.middleName, name.lastName].filter(Boolean).join(" ").trim();
}

function maskedAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `****${digits.slice(-4)}`;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="add-distributor-review-form__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DocumentPreviewButton({
  label,
  fileName,
  previewUrl,
  onboardingToken,
  docType,
}: {
  label: string;
  fileName: string | null;
  previewUrl: string | null;
  onboardingToken: string | null;
  docType: "pan" | "aadhaar";
}) {
  const [open, setOpen] = useState(false);
  const { previewUrl: resolvedPreviewUrl, loading } = usePartnerOnboardingDocumentPreview({
    onboardingToken,
    docType,
    fileName,
    previewUrl,
  });
  const isPdf = isDistributorDocumentPdf(fileName);

  if (!fileName) {
    return (
      <div className="add-distributor-review-form__doc">
        <span className="add-distributor-review-form__doc-label">{label}</span>
        <StatusBadge variant="warning">Not uploaded</StatusBadge>
      </div>
    );
  }

  return (
    <>
      <div className="add-distributor-review-form__doc">
        {loading ? (
          <div className="add-distributor-review-form__doc-thumb add-distributor-review-form__doc-thumb--loading">
            <Loader2 className="size-4 animate-spin" aria-hidden />
          </div>
        ) : resolvedPreviewUrl && !isPdf ? (
          <button
            type="button"
            className="add-distributor-review-form__doc-thumb-button"
            onClick={() => setOpen(true)}
            aria-label={`View ${label}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolvedPreviewUrl} alt="" className="add-distributor-review-form__doc-thumb" />
          </button>
        ) : resolvedPreviewUrl && isPdf ? (
          <button
            type="button"
            className="add-distributor-review-form__doc-thumb add-distributor-review-form__doc-thumb--pdf"
            onClick={() => setOpen(true)}
            aria-label={`View ${label}`}
          >
            <FileText className="size-4" aria-hidden />
          </button>
        ) : (
          <div className="add-distributor-review-form__doc-thumb add-distributor-review-form__doc-thumb--placeholder" />
        )}
        <div className="min-w-0 flex-1">
          <p className="add-distributor-review-form__doc-label">{label}</p>
          <p className="add-distributor-review-form__doc-name" title={fileName}>
            {fileName}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || !resolvedPreviewUrl}
          onClick={() => setOpen(true)}
        >
          <Eye className="size-3.5" aria-hidden />
          View
        </Button>
      </div>

      <AddDistributorDocumentPreviewDialog
        open={open}
        onOpenChange={setOpen}
        label={label}
        fileName={fileName}
        previewUrl={resolvedPreviewUrl}
        loading={loading}
      />
    </>
  );
}

export function AddDistributorReviewPanel({
  branchLabel,
  email,
  mobile,
  pan,
  name,
  bank,
  address,
  documents,
  profilePhotoPreviewUrl,
  onboardingToken,
}: AddDistributorReviewPanelProps) {
  const fullName = formatFullName(name);
  const addressLine = formatDistributorAddressLine(address);
  const bankModeLabel =
    bank.verificationMode === "manual" ? "Manual entry (HO review)" : "Registry verified";

  return (
    <div className="add-distributor-review-form">
      <section className="add-distributor-review-form__section add-distributor-review-form__section--hero">
        <div className="add-distributor-review-form__hero">
          <DistributorProfileAvatar
            name={fullName || ZYND_MITRA_COPY.singular}
            imageSrc={profilePhotoPreviewUrl}
            className="size-16 shrink-0 text-compact"
          />
          <div className="min-w-0">
            <p className="add-distributor-review-form__hero-name">{fullName || ZYND_MITRA_COPY.singular}</p>
            <p className="add-distributor-review-form__hero-meta">
              {pan.trim().toUpperCase()} · {branchLabel}
            </p>
            <p className="add-distributor-review-form__hero-meta">{email.trim()}</p>
            <p className="add-distributor-review-form__hero-meta">+91 {mobile}</p>
          </div>
        </div>
      </section>

      <section className="add-distributor-review-form__section">
        <h4 className="add-distributor-review-form__title">Payout bank</h4>
        <dl className="add-distributor-review-form__body">
          <ReviewRow label="Verification" value={bankModeLabel} />
          <ReviewRow label="Account holder" value={bank.accountHolderName} />
          <ReviewRow label="Bank" value={bank.bankName} />
          <ReviewRow label="Branch" value={bank.branchName} />
          <ReviewRow
            label="Account type"
            value={bank.accountType ? distributorBankAccountTypeLabel(bank.accountType) : ""}
          />
          <ReviewRow label="Account number" value={maskedAccountNumber(bank.accountNumber)} />
          <ReviewRow label="IFSC" value={bank.ifsc.trim().toUpperCase()} />
        </dl>
      </section>

      <section className="add-distributor-review-form__section">
        <h4 className="add-distributor-review-form__title">Registered address</h4>
        <p className="add-distributor-review-form__address">{addressLine}</p>
      </section>

      <section className="add-distributor-review-form__section">
        <h4 className="add-distributor-review-form__title">KYC documents</h4>
        <div className="add-distributor-review-form__docs">
          <DocumentPreviewButton
            label="PAN card"
            fileName={documents.panFileName}
            previewUrl={documents.panPreviewUrl}
            onboardingToken={onboardingToken}
            docType="pan"
          />
          <DocumentPreviewButton
            label="Aadhaar card"
            fileName={documents.aadharFileName}
            previewUrl={documents.aadhaarPreviewUrl}
            onboardingToken={onboardingToken}
            docType="aadhaar"
          />
        </div>
      </section>
    </div>
  );
}
