"use client";

import { useCallback, useMemo, useState } from "react";
import { Building2, FileImage, PenLine, UserRound, Users } from "lucide-react";

import { AdminKycSignatureViewDialog } from "@/components/users/admin-kyc-signature-view-dialog";

import {
  formatDateOnly,
  formatKycLabel,
  KycField,
  KycFieldGrid,
  KycPanelCarouselNav,
  KycPanelEmpty,
  KycPanelShell,
} from "@/components/users/admin-user-kyc-panel-shared";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminUserKycDetail, AdminUserKycNominee } from "@/lib/admin-api";
import { kycStepStatusVariant } from "@/components/users/user-status-badge";

type BankAccountView = {
  id: string;
  accountMasked: string;
  ifsc: string | null;
  accountType: string | null;
  holderName: string | null;
  bankName: string | null;
  branch: string | null;
  verificationStatus: string | null;
  isPrimary: boolean;
};

function buildBankAccounts(kyc: AdminUserKycDetail): BankAccountView[] {
  const fromInvestor = kyc.bank_accounts.map((account, index) => ({
    id: String(account.id ?? `investor-bank-${index}`),
    accountMasked: String(
      account.account_number_masked ??
        (account.account_number_last4 ? `•••• ${account.account_number_last4}` : "•••• ----"),
    ),
    ifsc: (account.ifsc_code as string | null) ?? null,
    accountType: (account.account_type as string | null) ?? null,
    holderName: (account.account_holder_name as string | null) ?? null,
    bankName: (account.bank_name as string | null) ?? null,
    branch: (account.branch_name as string | null) ?? null,
    verificationStatus: (account.verification_status as string | null) ?? null,
    isPrimary: Boolean(account.is_primary),
  }));

  if (fromInvestor.length > 0) {
    return fromInvestor;
  }

  const draft = kyc.bank_draft;
  if (!draft?.account_number_last4 && !draft?.ifsc_code) {
    return [];
  }

  return [
    {
      id: "bank-draft",
      accountMasked: draft.account_number_last4 ? `•••• ${draft.account_number_last4}` : "•••• ----",
      ifsc: draft.ifsc_code,
      accountType: draft.account_type,
      holderName: draft.account_holder_name,
      bankName: draft.bank_name,
      branch: draft.branch,
      verificationStatus: kyc.bank_verification_status,
      isPrimary: true,
    },
  ];
}

function hasBankData(kyc: AdminUserKycDetail) {
  return buildBankAccounts(kyc).length > 0;
}

function nomineeDisplayName(nominee: AdminUserKycNominee) {
  return nominee.full_name ?? nominee.name ?? "Nominee";
}

function nomineeIdMasked(nominee: AdminUserKycNominee) {
  const last4 = nominee.document_number_last4 ?? nominee.pan_last4;
  if (!last4) return null;
  return `•••• ${last4}`;
}

function BankAccountsPanel({ kyc }: { kyc: AdminUserKycDetail }) {
  const accounts = useMemo(() => buildBankAccounts(kyc), [kyc]);
  const [activeIndex, setActiveIndex] = useState(0);

  const safeIndex = accounts.length > 0 ? Math.min(activeIndex, accounts.length - 1) : 0;
  const activeAccount = accounts[safeIndex] ?? null;

  const goPrevious = useCallback(() => {
    setActiveIndex((current) => (current <= 0 ? accounts.length - 1 : current - 1));
  }, [accounts.length]);

  const goNext = useCallback(() => {
    setActiveIndex((current) => (current >= accounts.length - 1 ? 0 : current + 1));
  }, [accounts.length]);

  if (!hasBankData(kyc) || !activeAccount) {
    return (
      <KycPanelShell title="Bank accounts" icon={Building2}>
        <KycPanelEmpty
          icon={Building2}
          title="Bank details not added"
          description="Account information will appear after the customer completes bank verification."
        />
      </KycPanelShell>
    );
  }

  const verificationStatus = activeAccount.verificationStatus;

  return (
    <KycPanelShell
      title="Bank accounts"
      icon={Building2}
      headerExtra={
        <KycPanelCarouselNav
          activeIndex={safeIndex}
          total={accounts.length}
          onPrevious={goPrevious}
          onNext={goNext}
          label="bank account"
        />
      }
    >
      <div className="admin-user-kyc-banking-hero">
        <div className="admin-user-kyc-banking-hero__main">
          <p className="admin-user-kyc-banking-hero__account font-mono">{activeAccount.accountMasked}</p>
          <p className="admin-user-kyc-banking-hero__bank">{activeAccount.bankName ?? "Bank account"}</p>
          <div className="admin-user-kyc-banking-hero__badges">
            {activeAccount.isPrimary ? (
              <StatusBadge variant="info" showIcon={false}>
                Primary
              </StatusBadge>
            ) : null}
            {verificationStatus ? (
              <StatusBadge variant={kycStepStatusVariant(verificationStatus)}>
                {formatKycLabel(verificationStatus)}
              </StatusBadge>
            ) : null}
          </div>
        </div>
      </div>
      <KycFieldGrid>
        <KycField label="IFSC" value={activeAccount.ifsc} />
        <KycField label="Account type" value={formatKycLabel(activeAccount.accountType)} />
        <KycField label="Account holder" value={activeAccount.holderName} />
        <KycField label="Branch" value={activeAccount.branch} />
      </KycFieldGrid>
      {accounts.length > 1 ? (
        <div className="admin-user-kyc-carousel-dots" role="tablist" aria-label="Bank account pages">
          {accounts.map((account, index) => (
            <button
              key={account.id}
              type="button"
              role="tab"
              aria-selected={index === safeIndex}
              aria-label={`Bank account ${index + 1} of ${accounts.length}`}
              className={
                index === safeIndex
                  ? "admin-user-kyc-carousel-dots__dot admin-user-kyc-carousel-dots__dot--active"
                  : "admin-user-kyc-carousel-dots__dot"
              }
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </KycPanelShell>
  );
}

function SignaturePanel({
  kyc,
  signatureDocumentId,
  hasDownload,
}: {
  kyc: AdminUserKycDetail;
  signatureDocumentId: string | null;
  hasDownload: boolean;
}) {
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const isUploaded = Boolean(kyc.signature?.has_upload || signatureDocumentId);
  const signatureDocument = useMemo(
    () => kyc.documents.find((document) => document.doc_type === "signature") ?? null,
    [kyc.documents],
  );

  if (!isUploaded && !kyc.signature?.mode) {
    return (
      <KycPanelShell title="Signature" icon={PenLine}>
        <KycPanelEmpty
          icon={PenLine}
          title="Signature not uploaded"
          description="A drawn or uploaded signature will appear here once the customer completes that step."
        />
      </KycPanelShell>
    );
  }

  return (
    <>
      <KycPanelShell title="Signature" icon={PenLine}>
        <div className="admin-user-kyc-banking-signature-hero">
          <div className="admin-user-kyc-banking-signature-hero__icon" aria-hidden>
            <PenLine className="size-5" strokeWidth={2.25} />
          </div>
          <div className="admin-user-kyc-banking-signature-hero__copy">
            <p className="admin-user-kyc-banking-signature-hero__title">
              {isUploaded ? "Signature on file" : "Signature pending"}
            </p>
            <p className="admin-user-kyc-banking-signature-hero__hint">
              {formatKycLabel(kyc.signature?.mode) ?? "Draw"} mode
            </p>
          </div>
          <StatusBadge variant={isUploaded ? "success" : "warning"}>
            {isUploaded ? "Uploaded" : "Not uploaded"}
          </StatusBadge>
        </div>
        {signatureDocumentId && hasDownload ? (
          <Button
            variant="outline"
            size="sm"
            className="admin-user-kyc-banking-signature-hero__action"
            onClick={() => setSignatureDialogOpen(true)}
          >
            <FileImage className="size-3.5" aria-hidden />
            View signature
          </Button>
        ) : null}
      </KycPanelShell>
      <AdminKycSignatureViewDialog
        open={signatureDialogOpen}
        onOpenChange={setSignatureDialogOpen}
        documentId={signatureDocumentId}
        hasDownload={hasDownload}
        filename={signatureDocument?.original_filename}
        mode={kyc.signature?.mode}
      />
    </>
  );
}

function NomineeCard({ nominee, index }: { nominee: AdminUserKycNominee; index: number }) {
  const name = nomineeDisplayName(nominee);
  const idMasked = nomineeIdMasked(nominee);

  return (
    <article className="admin-user-kyc-nominee-card">
      <header className="admin-user-kyc-nominee-card__head">
        <div className="admin-user-kyc-nominee-card__avatar" aria-hidden>
          <UserRound className="size-4" strokeWidth={2.25} />
        </div>
        <div className="admin-user-kyc-nominee-card__title-block">
          <p className="admin-user-kyc-nominee-card__index">Nominee {index + 1}</p>
          <p className="admin-user-kyc-nominee-card__name">{name}</p>
        </div>
        {nominee.share_percent != null ? (
          <StatusBadge variant="info" showIcon={false} className="shrink-0">
            {nominee.share_percent}%
          </StatusBadge>
        ) : null}
      </header>
      <KycFieldGrid>
        <KycField label="Relationship" value={formatKycLabel(nominee.relationship)} />
        <KycField label="Date of birth" value={formatDateOnly(nominee.date_of_birth)} />
        <KycField
          label={nominee.document_type ? formatKycLabel(nominee.document_type) ?? "ID" : "ID (last 4)"}
          value={idMasked}
        />
        <KycField label="Guardian" value={nominee.guardian_name} />
        <KycField
          label="Guardian PAN"
          value={nominee.guardian_pan_last4 ? `•••• ${nominee.guardian_pan_last4}` : null}
        />
        <KycField label="Sync status" value={formatKycLabel(nominee.sync_status)} />
      </KycFieldGrid>
    </article>
  );
}

function NomineesPanel({ kyc }: { kyc: AdminUserKycDetail }) {
  const nominees = kyc.nominees;

  if (nominees.length === 0) {
    return (
      <KycPanelShell title="Nominees" icon={Users} className="admin-user-kyc-identity-panel--full">
        <KycPanelEmpty
          icon={Users}
          title="No nominees added"
          description="Nominee information will appear once the customer completes the nominee step."
        />
      </KycPanelShell>
    );
  }

  return (
    <KycPanelShell
      title="Nominees"
      icon={Users}
      className="admin-user-kyc-identity-panel--full"
      headerExtra={
        nominees.length > 0 ? (
          <span className="admin-user-kyc-nominee-count">
            {nominees.length} {nominees.length === 1 ? "nominee" : "nominees"}
          </span>
        ) : undefined
      }
    >
      <div className="admin-user-kyc-nominee-grid">
        {nominees.map((nominee, index) => (
          <NomineeCard
            key={`${nominee.full_name ?? nominee.name ?? index}-${index}`}
            nominee={nominee}
            index={index}
          />
        ))}
      </div>
    </KycPanelShell>
  );
}

type AdminUserKycBankingPanelsProps = {
  kyc: AdminUserKycDetail;
  hasDownload: boolean;
  signatureDocumentId: string | null;
};

export function AdminUserKycBankingPanels({
  kyc,
  hasDownload,
  signatureDocumentId,
}: AdminUserKycBankingPanelsProps) {
  return (
    <div className="admin-user-kyc-identity">
      <div className="admin-user-kyc-identity__grid">
        <BankAccountsPanel kyc={kyc} />
        <SignaturePanel
          kyc={kyc}
          signatureDocumentId={signatureDocumentId}
          hasDownload={hasDownload}
        />
        <NomineesPanel kyc={kyc} />
      </div>
    </div>
  );
}
