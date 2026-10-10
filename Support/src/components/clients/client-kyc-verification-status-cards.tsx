"use client";

import {
  BadgeCheck,
  Building2,
  FileSignature,
  Fingerprint,
  type LucideIcon,
} from "lucide-react";

import { ClientKycPartnerRefCopy } from "@/components/clients/client-kyc-partner-ref-copy";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { SupportKycVerificationStatusCard } from "@/lib/support-client-kyc-partner-model";
import { formatDistributorDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const CARD_ICONS: Record<SupportKycVerificationStatusCard["id"], LucideIcon> = {
  pan: Fingerprint,
  digilocker: BadgeCheck,
  bank: Building2,
  esign: FileSignature,
};

function statusBadgeVariant(
  status: SupportKycVerificationStatusCard["status"],
): "success" | "warning" | "destructive" | "neutral" | "info" {
  switch (status) {
    case "verified":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "destructive";
    case "skipped":
      return "neutral";
    case "not_started":
      return "info";
    default:
      return "neutral";
  }
}

type ClientKycVerificationStatusCardsProps = {
  cards: SupportKycVerificationStatusCard[];
  className?: string;
};

export function ClientKycVerificationStatusCards({
  cards,
  className,
}: ClientKycVerificationStatusCardsProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;

  return (
    <section className={cn("support-client-kyc-verification-status", className)}>
      <header className="support-client-kyc-verification-status__header">
        <h2 className="support-client-kyc-verification-status__title">{copy.verificationStatusTitle}</h2>
      </header>
      <div className="support-client-kyc-verification-status__grid">
        {cards.map((card) => {
          const Icon = CARD_ICONS[card.id];
          return (
            <article key={card.id} className="support-client-kyc-verification-status__card">
              <div className="support-client-kyc-verification-status__card-head">
                <span className="support-client-kyc-verification-status__card-icon" aria-hidden>
                  <Icon strokeWidth={2.1} />
                </span>
                <StatusBadge variant={statusBadgeVariant(card.status)}>{card.statusLabel}</StatusBadge>
              </div>
              <p className="support-client-kyc-verification-status__card-label">{card.label}</p>
              <p className="support-client-kyc-verification-status__card-hint">{card.hint}</p>
              {card.partnerRef ? <ClientKycPartnerRefCopy partnerRef={card.partnerRef} /> : null}
              {card.updatedAt ? (
                <p className="support-client-kyc-verification-status__updated">
                  <span className="support-client-kyc-verification-status__updated-label">{copy.verificationUpdatedLabel}</span>
                  <span>{formatDistributorDateTime(card.updatedAt)}</span>
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
