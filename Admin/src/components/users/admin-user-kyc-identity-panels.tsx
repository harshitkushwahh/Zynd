"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Eye,
  FileImage,
  FileText,
  Fingerprint,
  IdCard,
  Landmark,
  MapPin,
  PenLine,
  UserRound,
} from "lucide-react";

import {
  formatDateOnly,
  formatKycLabel,
  KycField,
  KycFieldGrid,
  KycPanelEmpty,
  KycPanelShell,
} from "@/components/users/admin-user-kyc-panel-shared";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminKycDocument, AdminUserKycDetail, AdminUserKycPan, AdminUserKycPersonal } from "@/lib/admin-api";
import { documentReviewStatusVariant, kycStepStatusVariant } from "@/components/users/user-status-badge";
import { cn } from "@/lib/utils";

const PEP_EXPOSED_LABELS: Record<string, string> = {
  not_applicable: "No",
  pep_exposed: "Yes — PEP exposed",
  pep_related: "Yes — related to a PEP",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN card",
  profile_image: "Profile photo",
  bank_statement: "Bank statement",
  signature: "Signature",
  address_proof: "Address proof",
  nominee_id: "Nominee ID",
};

const DOCUMENT_TYPE_ICONS: Record<string, LucideIcon> = {
  aadhaar: Fingerprint,
  pan: IdCard,
  profile_image: FileImage,
  bank_statement: Landmark,
  signature: PenLine,
  address_proof: FileText,
  nominee_id: IdCard,
};

function formatPepExposed(value: string | null | undefined) {
  if (!value) return null;
  return PEP_EXPOSED_LABELS[value] ?? formatKycLabel(value);
}

function hasPanData(pan: AdminUserKycPan | null | undefined) {
  return Boolean(pan?.pan_last4 || pan?.full_name || pan?.date_of_birth || pan?.pan_category);
}

function hasPersonalData(personal: AdminUserKycPersonal | null | undefined) {
  if (!personal) return false;
  return Object.values(personal).some((value) => value != null && value !== "");
}

function hasAddressData(kyc: AdminUserKycDetail) {
  return Boolean(kyc.address?.permanent?.line1 || kyc.address?.correspondence?.line1);
}

function formatAddressBlock(
  block: {
    line1?: string | null;
    line2?: string | null;
    line3?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null | undefined,
) {
  if (!block?.line1) return null;
  const street = [block.line1, block.line2, block.line3].filter(Boolean).join(", ");
  const cityLine = [block.city, block.state, block.pincode ?? block.postal_code]
    .filter(Boolean)
    .join(", ");
  return { street, cityLine, country: block.country ?? null };
}

function PanIdentityPanel({ kyc }: { kyc: AdminUserKycDetail }) {
  if (!hasPanData(kyc.pan)) {
    return (
      <KycPanelShell title="PAN details" icon={Fingerprint}>
        <KycPanelEmpty
          icon={Fingerprint}
          title="PAN not captured yet"
          description="Identity details will appear once the customer completes PAN verification."
        />
      </KycPanelShell>
    );
  }

  const panMasked = kyc.pan?.pan_last4 ? `•••• ${kyc.pan.pan_last4}` : null;
  const verificationStatus = kyc.pan_verification_status;

  return (
    <KycPanelShell title="PAN details" icon={Fingerprint}>
      <div className="admin-user-kyc-identity-pan-hero">
        <div className="admin-user-kyc-identity-pan-hero__main">
          <p className="admin-user-kyc-identity-pan-hero__name">{kyc.pan?.full_name ?? "—"}</p>
          {panMasked ? (
            <span className="admin-user-kyc-identity-pan-hero__pan font-mono">{panMasked}</span>
          ) : null}
        </div>
        {verificationStatus ? (
          <StatusBadge variant={kycStepStatusVariant(verificationStatus)}>
            {formatKycLabel(verificationStatus)}
          </StatusBadge>
        ) : null}
      </div>
      <KycFieldGrid>
        <KycField label="Date of birth" value={formatDateOnly(kyc.pan?.date_of_birth)} />
        <KycField label="Category" value={formatKycLabel(kyc.pan?.pan_category)} />
      </KycFieldGrid>
    </KycPanelShell>
  );
}

function PersonalIdentityPanel({ kyc }: { kyc: AdminUserKycDetail }) {
  if (!hasPersonalData(kyc.personal)) {
    return (
      <KycPanelShell title="Personal information" icon={UserRound}>
        <KycPanelEmpty
          icon={UserRound}
          title="Personal details not added"
          description="Occupation, income, and family details appear after the personal step is saved."
        />
      </KycPanelShell>
    );
  }

  return (
    <KycPanelShell title="Personal information" icon={UserRound}>
      <KycFieldGrid>
        <KycField label="Father's name" value={kyc.personal?.fathers_name} />
        <KycField label="Gender" value={formatKycLabel(kyc.personal?.gender)} />
        <KycField label="Marital status" value={formatKycLabel(kyc.personal?.marital_status)} />
        <KycField label="Occupation" value={formatKycLabel(kyc.personal?.occupation)} />
        <KycField label="Income slab" value={formatKycLabel(kyc.personal?.income_slab)} />
        <KycField label="Place of birth" value={formatKycLabel(kyc.personal?.place_of_birth)} />
        <KycField label="Nationality" value={kyc.personal?.nationality} />
        <KycField
          label="Politically exposed"
          value={formatPepExposed(kyc.personal?.pep_exposed)}
        />
      </KycFieldGrid>
    </KycPanelShell>
  );
}

function AddressIdentityPanel({ kyc }: { kyc: AdminUserKycDetail }) {
  const permanent = formatAddressBlock(kyc.address?.permanent);
  const correspondence = formatAddressBlock(kyc.address?.correspondence);
  const addressesMatch =
    permanent &&
    correspondence &&
    permanent.street === correspondence.street &&
    permanent.cityLine === correspondence.cityLine &&
    permanent.country === correspondence.country;

  if (!hasAddressData(kyc)) {
    return (
      <KycPanelShell title="Address" icon={MapPin} className="admin-user-kyc-identity-panel--full">
        <KycPanelEmpty
          icon={MapPin}
          title="No address on file"
          description="Address information appears once the customer completes the address step."
        />
      </KycPanelShell>
    );
  }

  return (
    <KycPanelShell title="Address" icon={MapPin} className="admin-user-kyc-identity-panel--full">
      {addressesMatch ? (
        <p className="admin-user-kyc-identity-address-note">
          Permanent and correspondence addresses match
        </p>
      ) : null}
      <div className="admin-user-kyc-identity-address-grid">
        {permanent ? (
          <article className="admin-user-kyc-identity-address-card">
            <div className="admin-user-kyc-identity-address-card__head">
              <MapPin className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              <span>Permanent address</span>
            </div>
            <p className="admin-user-kyc-identity-address-card__street">{permanent.street}</p>
            {permanent.cityLine ? (
              <p className="admin-user-kyc-identity-address-card__city">{permanent.cityLine}</p>
            ) : null}
            {permanent.country ? (
              <p className="admin-user-kyc-identity-address-card__country">{permanent.country}</p>
            ) : null}
          </article>
        ) : null}
        {correspondence && !addressesMatch ? (
          <article className="admin-user-kyc-identity-address-card">
            <div className="admin-user-kyc-identity-address-card__head">
              <MapPin className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              <span>Correspondence address</span>
            </div>
            <p className="admin-user-kyc-identity-address-card__street">{correspondence.street}</p>
            {correspondence.cityLine ? (
              <p className="admin-user-kyc-identity-address-card__city">{correspondence.cityLine}</p>
            ) : null}
            {correspondence.country ? (
              <p className="admin-user-kyc-identity-address-card__country">{correspondence.country}</p>
            ) : null}
          </article>
        ) : null}
        {correspondence && addressesMatch ? (
          <article className="admin-user-kyc-identity-address-card admin-user-kyc-identity-address-card--muted">
            <div className="admin-user-kyc-identity-address-card__head">
              <MapPin className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              <span>Also used for correspondence</span>
            </div>
            <p className="admin-user-kyc-identity-address-card__hint">
              Same address applies to both permanent and correspondence records.
            </p>
          </article>
        ) : null}
      </div>
    </KycPanelShell>
  );
}

function DocumentIdentityCard({
  document,
  hasDownload,
  actionLoading,
  onPreview,
}: {
  document: AdminKycDocument;
  hasDownload: boolean;
  actionLoading: string | null;
  onPreview: (documentId: string) => void;
}) {
  const DocIcon = DOCUMENT_TYPE_ICONS[document.doc_type] ?? FileText;
  const reviewStatus = document.kyc_review_status ?? document.status ?? "pending";
  const label =
    DOCUMENT_TYPE_LABELS[document.doc_type] ?? formatKycLabel(document.doc_type) ?? "Document";

  return (
    <article className="admin-user-kyc-identity-document-card">
      <div className="admin-user-kyc-identity-document-card__main">
        <div className="admin-user-kyc-identity-document-card__icon" aria-hidden>
          <DocIcon className="size-4" strokeWidth={2.25} />
        </div>
        <div className="admin-user-kyc-identity-document-card__copy">
          <div className="admin-user-kyc-identity-document-card__title-row">
            <p className="admin-user-kyc-identity-document-card__title">{label}</p>
            <StatusBadge variant="neutral" showIcon={false} className="shrink-0">
              v{document.version}
            </StatusBadge>
          </div>
          <p className="admin-user-kyc-identity-document-card__filename">{document.original_filename}</p>
          <div className="admin-user-kyc-identity-document-card__meta">
            <StatusBadge variant={documentReviewStatusVariant(reviewStatus)} showIcon={false}>
              {formatKycLabel(reviewStatus)}
            </StatusBadge>
            <span className="admin-user-kyc-identity-document-card__date">
              {formatDateOnly(document.created_at)}
            </span>
          </div>
        </div>
      </div>
      {hasDownload ? (
        <Button
          size="sm"
          variant="outline"
          className="admin-user-kyc-identity-document-card__action"
          disabled={actionLoading === `preview-${document.id}`}
          onClick={() => onPreview(document.id)}
        >
          <Eye className="size-3.5" aria-hidden />
          View
        </Button>
      ) : null}
    </article>
  );
}

function DocumentsIdentityPanel({
  kyc,
  hasDownload,
  actionLoading,
  onPreview,
}: {
  kyc: AdminUserKycDetail;
  hasDownload: boolean;
  actionLoading: string | null;
  onPreview: (documentId: string) => void;
}) {
  if (kyc.documents.length === 0) {
    return (
      <KycPanelShell title="Uploaded documents" icon={FileText} className="admin-user-kyc-identity-panel--full">
        <KycPanelEmpty
          icon={FileText}
          title="No documents uploaded"
          description="Uploaded KYC files will appear here for viewing."
        />
      </KycPanelShell>
    );
  }

  return (
    <KycPanelShell title="Uploaded documents" icon={FileText} className="admin-user-kyc-identity-panel--full">
      <div className="admin-user-kyc-identity-documents-grid">
        {kyc.documents.map((document) => (
          <DocumentIdentityCard
            key={document.id}
            document={document}
            hasDownload={hasDownload}
            actionLoading={actionLoading}
            onPreview={onPreview}
          />
        ))}
      </div>
    </KycPanelShell>
  );
}

type AdminUserKycIdentityPanelsProps = {
  kyc: AdminUserKycDetail;
  hasDownload: boolean;
  actionLoading: string | null;
  onPreview: (documentId: string) => void;
};

export function AdminUserKycIdentityPanels({
  kyc,
  hasDownload,
  actionLoading,
  onPreview,
}: AdminUserKycIdentityPanelsProps) {
  return (
    <div className="admin-user-kyc-identity">
      {(kyc.external_kyc_status || kyc.kyc_form_status) && (
        <div className="admin-user-kyc-identity-status-strip">
          {kyc.external_kyc_status ? (
            <div className="admin-user-kyc-identity-status-chip">
              <span className="admin-user-kyc-identity-status-chip__label">External KYC</span>
              <span className="admin-user-kyc-identity-status-chip__value">
                {formatKycLabel(kyc.external_kyc_status)}
              </span>
            </div>
          ) : null}
          {kyc.kyc_form_status ? (
            <div className="admin-user-kyc-identity-status-chip">
              <span className="admin-user-kyc-identity-status-chip__label">KYC form</span>
              <span className="admin-user-kyc-identity-status-chip__value">
                {formatKycLabel(kyc.kyc_form_status)}
              </span>
            </div>
          ) : null}
        </div>
      )}

      <div className="admin-user-kyc-identity__grid">
        <PanIdentityPanel kyc={kyc} />
        <PersonalIdentityPanel kyc={kyc} />
        <AddressIdentityPanel kyc={kyc} />
        <DocumentsIdentityPanel
          kyc={kyc}
          hasDownload={hasDownload}
          actionLoading={actionLoading}
          onPreview={onPreview}
        />
      </div>
    </div>
  );
}
