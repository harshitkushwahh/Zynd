"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Braces } from "lucide-react";

import {
  ClientKycPayloadViewDialog,
  type ClientKycPayloadMetaRow,
} from "@/components/clients/client-kyc-payload-view-dialog";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { kycPayloadPreviewSummary } from "@/lib/kyc-payload-fields";
import { cn } from "@/lib/utils";

type ClientKycPayloadOpenCardProps = {
  title: string;
  subtitle?: string | null;
  badge?: { label: string; variant: StatusBadgeVariant } | null;
  dialogTitle: string;
  dialogDescription?: string;
  dialogIcon?: LucideIcon;
  metaRows?: ClientKycPayloadMetaRow[];
  payload: Record<string, unknown>;
  className?: string;
  trailing?: ReactNode;
};

export function ClientKycPayloadOpenCard({
  title,
  subtitle,
  badge,
  dialogTitle,
  dialogDescription,
  dialogIcon = Braces,
  metaRows,
  payload,
  className,
  trailing,
}: ClientKycPayloadOpenCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const [open, setOpen] = useState(false);
  const previewChips = useMemo(() => kycPayloadPreviewSummary(payload), [payload]);
  const DialogIcon = dialogIcon;

  return (
    <>
      <button
        type="button"
        className={cn("support-client-kyc-payload-open-card", className)}
        onClick={() => setOpen(true)}
        aria-label={`${copy.openPayloadCardAriaPrefix} ${title}`}
      >
        <div className="support-client-kyc-payload-open-card__head">
          <span className="support-client-kyc-payload-open-card__icon" aria-hidden>
            <DialogIcon strokeWidth={2.25} />
          </span>
          <div className="support-client-kyc-payload-open-card__titles min-w-0">
            <p className="support-client-kyc-payload-open-card__title">{title}</p>
            {subtitle ? (
              <p className="support-client-kyc-payload-open-card__subtitle">{subtitle}</p>
            ) : null}
          </div>
          <span className="support-client-kyc-payload-open-card__action" aria-hidden>
            <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
          </span>
        </div>
        <div className="support-client-kyc-payload-open-card__meta">
          {badge ? (
            <StatusBadge variant={badge.variant} showIcon={false} className="shrink-0">
              {badge.label}
            </StatusBadge>
          ) : null}
          {trailing}
        </div>
        {previewChips.length > 0 ? (
          <ul className="support-client-kyc-payload-open-card__chips">
            {previewChips.map((chip) => (
              <li key={chip} className="support-client-kyc-payload-open-card__chip">
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="support-client-kyc-payload-open-card__hint">{copy.viewPayloadCardHint}</p>
      </button>
      <ClientKycPayloadViewDialog
        open={open}
        onOpenChange={setOpen}
        title={dialogTitle}
        description={dialogDescription}
        icon={dialogIcon}
        metaRows={metaRows}
        payload={payload}
      />
    </>
  );
}
