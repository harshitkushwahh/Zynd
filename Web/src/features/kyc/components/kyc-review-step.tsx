"use client";

import { Building2, CreditCard, Users, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { KycReviewAccordion } from "@/features/kyc/components/kyc-review-accordion";
import { KycReviewBankSection } from "@/features/kyc/components/kyc-review-bank-section";
import { KycReviewNomineeEmpty } from "@/features/kyc/components/kyc-review-nominee-empty";
import { KycReviewPanSection } from "@/features/kyc/components/kyc-review-pan-section";
import type { KycJourneyDraft } from "@/features/kyc/lib/kyc-journey-draft";
import type { KycNomineeRecord } from "@/features/kyc/lib/kyc-nominee";
import {
  KYC_GENDER_OPTIONS,
  KYC_INCOME_SLAB_OPTIONS,
  KYC_MARITAL_STATUS_OPTIONS,
  KYC_OCCUPATION_OPTIONS,
  KYC_PEP_OPTIONS,
  lookupKycEnumLabel,
} from "@/features/kyc/lib/kyc-master-data-options";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycReviewStepProps = {
  draft: KycJourneyDraft;
  requiresFullKyc?: boolean;
  onSubmit: () => void;
  onAddNominee: () => void;
  familyGroupRepromptNominee?: KycNomineeRecord | null;
  onFamilyGroupRepromptInvite?: () => void;
  onFamilyGroupRepromptDismiss?: () => void;
};

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;

  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="text-caption font-medium text-foreground sm:max-w-[60%] sm:text-right">
        {value}
      </span>
    </div>
  );
}

function formatAddressBlock(
  address: NonNullable<KycJourneyDraft["address"]>["permanent"],
) {
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export function KycReviewStep({
  draft,
  requiresFullKyc = true,
  onSubmit,
  onAddNominee,
  familyGroupRepromptNominee = null,
  onFamilyGroupRepromptInvite,
  onFamilyGroupRepromptDismiss,
}: KycReviewStepProps) {
  const pan = draft.pan;
  const address = draft.address;
  const personalInfo = draft.personalInfo;
  const nominees = draft.nominees ?? [];
  const bank = draft.bank;
  const signature = draft.signature;

  const panSummary = pan
    ? `${pan.panNumber} · ${[pan.firstName, pan.middleName, pan.lastName].filter(Boolean).join(" ")}`
    : undefined;

  const panAccordionBadge = pan ? (
    <StatusBadge variant="success" showIcon={false} className="h-5 px-2 text-[10px]">
      {copy.kyc.review.pan.verifiedBadge}
    </StatusBadge>
  ) : null;

  const addressSummary = address
    ? `${address.permanent.city}, ${address.permanent.state}`
    : undefined;

  const personalSummary = personalInfo
    ? `${personalInfo.gender} · ${personalInfo.nationality}`
    : undefined;

  const nomineeSummary =
    nominees.length > 0
      ? copy.kyc.nominee.list.slotsLabel(nominees.length, 3)
      : undefined;

  const bankSummary = bank
    ? `${bank.accountDetails.bankName} · ••••${bank.accountNumber.slice(-4)}`
    : undefined;

  const bankAccordionBadge = bank ? (
    <StatusBadge variant="success" showIcon={false} className="h-5 px-2 text-[10px]">
      {copy.kyc.review.bank.verifiedBadge}
    </StatusBadge>
  ) : null;

  const signatureSummary = signature
    ? signature.mode === "draw"
      ? copy.kyc.signature.drawTab
      : copy.kyc.signature.uploadTab
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {familyGroupRepromptNominee ? (
        <div className="shrink-0 rounded-[var(--radius-card)] border border-primary/20 bg-primary/5 px-3 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UsersRound className="size-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-caption font-medium text-foreground">
                  {copy.kyc.familyGroup.reviewBannerTitle}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {copy.kyc.familyGroup.reviewBannerDescription(familyGroupRepromptNominee.core.fullName)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground/80">
                  {copy.kyc.familyGroup.legalDisclaimer}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={onFamilyGroupRepromptInvite}>
                  {copy.kyc.familyGroup.reviewBannerInvite}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onFamilyGroupRepromptDismiss}>
                  {copy.kyc.familyGroup.reviewBannerDismiss}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]">
        <KycReviewAccordion
          title={copy.kyc.review.sections.pan}
          summary={panSummary}
          empty={!pan}
          defaultOpen
          icon={<CreditCard className="size-4" strokeWidth={2} />}
          badge={panAccordionBadge}
        >
          {pan ? <KycReviewPanSection pan={pan} /> : null}
        </KycReviewAccordion>

        <KycReviewAccordion
          title={copy.kyc.review.sections.address}
          summary={addressSummary}
          empty={!address}
        >
          {address ? (
            <>
              <ReviewRow
                label={copy.kyc.address.permanentTab}
                value={formatAddressBlock(address.permanent)}
              />
              <ReviewRow
                label={copy.kyc.address.correspondenceTab}
                value={
                  address.sameAsPermanent
                    ? formatAddressBlock(address.permanent)
                    : formatAddressBlock(address.correspondence)
                }
              />
            </>
          ) : null}
        </KycReviewAccordion>

        <KycReviewAccordion
          title={copy.kyc.review.sections.personalInfo}
          summary={personalSummary}
          empty={!personalInfo}
        >
          {personalInfo ? (
            <>
              <ReviewRow label={copy.kyc.personalInfo.fields.fathersName} value={personalInfo.fathersName} />
              <ReviewRow
                label={copy.kyc.personalInfo.fields.gender}
                value={lookupKycEnumLabel(personalInfo.gender, KYC_GENDER_OPTIONS)}
              />
              <ReviewRow
                label={copy.kyc.personalInfo.fields.incomeSlab}
                value={lookupKycEnumLabel(personalInfo.incomeSlab, KYC_INCOME_SLAB_OPTIONS)}
              />
              <ReviewRow
                label={copy.kyc.personalInfo.fields.occupation}
                value={lookupKycEnumLabel(personalInfo.occupation, KYC_OCCUPATION_OPTIONS)}
              />
              <ReviewRow
                label={copy.kyc.personalInfo.fields.maritalStatus}
                value={lookupKycEnumLabel(personalInfo.maritalStatus, KYC_MARITAL_STATUS_OPTIONS)}
              />
              <ReviewRow
                label={copy.kyc.personalInfo.fields.pepExposed}
                value={lookupKycEnumLabel(personalInfo.pepExposed, KYC_PEP_OPTIONS)}
              />
              <ReviewRow label={copy.kyc.personalInfo.fields.placeOfBirth} value={personalInfo.placeOfBirth} />
              <ReviewRow label={copy.kyc.personalInfo.fields.nationality} value={personalInfo.nationality} />
            </>
          ) : null}
        </KycReviewAccordion>

        <KycReviewAccordion
          title={copy.kyc.review.sections.nominee}
          summary={nomineeSummary}
          empty={nominees.length === 0}
          emptyTone="warning"
          emptySummary={copy.kyc.review.nominee.emptySummary}
          emptyContent={<KycReviewNomineeEmpty onAddNominee={onAddNominee} />}
          icon={<Users className="size-4" strokeWidth={2} />}
        >
          {nominees.map((nominee, index) => (
            <div key={nominee.id} className={cn(index > 0 && "border-t border-border/60 pt-2")}>
              <ReviewRow label={copy.kyc.nominee.fields.fullName} value={nominee.core.fullName} />
              <ReviewRow label={copy.kyc.nominee.fields.relationship} value={nominee.core.relationship} />
              <ReviewRow
                label={copy.kyc.nominee.fields.sharePercent}
                value={copy.kyc.nominee.list.shareLabel(nominee.core.sharePercent)}
              />
            </div>
          ))}
        </KycReviewAccordion>

        <KycReviewAccordion
          title={copy.kyc.review.sections.bank}
          summary={bankSummary}
          empty={!bank}
          icon={<Building2 className="size-4" strokeWidth={2} />}
          badge={bankAccordionBadge}
        >
          {bank ? <KycReviewBankSection bank={bank} /> : null}
        </KycReviewAccordion>

        {requiresFullKyc ? (
          <KycReviewAccordion
            title={copy.kyc.review.sections.signature}
            summary={signatureSummary}
            empty={!signature}
          >
            {signature ? (
              <>
                <ReviewRow
                  label={copy.kyc.review.signatureMethod}
                  value={
                    signature.mode === "draw"
                      ? copy.kyc.signature.drawTab
                      : copy.kyc.signature.uploadTab
                  }
                />
                <div className="py-2">
                  <div className="overflow-hidden rounded-[var(--radius-card)] border border-border/80 bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signature.dataUrl}
                      alt={copy.kyc.signature.previewAlt}
                      className="mx-auto max-h-28 w-full object-contain"
                    />
                  </div>
                </div>
              </>
            ) : null}
          </KycReviewAccordion>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border/60 pt-4">
        <Button type="button" size="lg" className="w-full" onClick={onSubmit}>
          {copy.kyc.review.submit}
        </Button>
      </div>
    </div>
  );
}
