"use client";

import { useState } from "react";
import { FileJson } from "lucide-react";

import { ClientKycPartnerResponseSubTabs } from "@/components/clients/client-kyc-partner-response-sub-tabs";
import { ClientKycPayloadOpenCard } from "@/components/clients/client-kyc-payload-open-card";
import {
  SupportSelect,
  SupportSelectContent,
  SupportSelectItem,
  SupportSelectTrigger,
  SupportSelectValue,
  SUPPORT_SELECT_CONTENT_CLASS,
} from "@/components/ui/support-select";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type {
  SupportClientKycPartnerSnapshot,
  SupportKycPartnerResponseTab,
  SupportKycPartnerResponseTabId,
  SupportKycPartnerResponseVariant,
  SupportKycPartnerVerificationStatus,
} from "@/lib/support-client-kyc-partner-model";
import {
  buildIfscSummaryMetaRows,
  buildPartnerResponseMetaRows,
} from "@/lib/support-kyc-payload-meta";
import { cn } from "@/lib/utils";

function statusBadgeVariant(
  status: SupportKycPartnerVerificationStatus,
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

function hasPayload(payload: Record<string, unknown>) {
  return Object.values(payload).some((value) => value != null);
}

function PartnerResponseEmpty({ copy }: { copy: (typeof DISTRIBUTOR_CLIENT_COPY)["kyc"] }) {
  return (
    <div className="support-client-kyc-partner-responses__empty">
      <p className="support-client-kyc-partner-responses__empty-title">{copy.partnerResponseEmptyTitle}</p>
      <p className="support-client-kyc-partner-responses__empty-description">{copy.partnerResponseEmptyDescription}</p>
    </div>
  );
}

function PartnerResponseVariantSelect({
  variants,
  value,
  onChange,
  label,
}: {
  variants: SupportKycPartnerResponseVariant[];
  value: string;
  onChange: (variantId: string) => void;
  label: string;
}) {
  const selected = variants.find((row) => row.id === value) ?? variants[0];

  return (
    <SupportSelect value={value} onValueChange={(next) => next && onChange(next)}>
      <SupportSelectTrigger className="support-client-kyc-partner-responses__variant-trigger">
        <SupportSelectValue placeholder={label}>{selected?.label ?? label}</SupportSelectValue>
      </SupportSelectTrigger>
      <SupportSelectContent className={SUPPORT_SELECT_CONTENT_CLASS}>
        {variants.map((variant) => (
          <SupportSelectItem key={variant.id} value={variant.id}>
            {variant.label}
          </SupportSelectItem>
        ))}
      </SupportSelectContent>
    </SupportSelect>
  );
}

function PartnerResponseTabBody({
  tab,
  variant,
  copy,
}: {
  tab: SupportKycPartnerResponseTabId;
  variant: SupportKycPartnerResponseVariant;
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["kyc"];
}) {
  if (!hasPayload(variant.payload)) {
    return <PartnerResponseEmpty copy={copy} />;
  }

  const tabLabel = copy.partnerResponsesSubTabs[tab];
  const metaRows = [
    ...buildPartnerResponseMetaRows(variant),
    ...(tab === "ifsc" && variant.summary ? buildIfscSummaryMetaRows(variant.summary) : []),
  ];

  return (
    <ClientKycPayloadOpenCard
      title={tabLabel}
      subtitle={variant.partner}
      badge={{ label: variant.statusLabel, variant: statusBadgeVariant(variant.status) }}
      dialogTitle={`${tabLabel} · ${copy.partnerResponsePayloadTitle}`}
      dialogDescription={copy.payloadDialogDescription}
      dialogIcon={FileJson}
      metaRows={metaRows}
      payload={variant.payload}
    />
  );
}

type ClientKycPartnerResponsesPanelProps = {
  snapshot: SupportClientKycPartnerSnapshot;
  className?: string;
};

export function ClientKycPartnerResponsesPanel({ snapshot, className }: ClientKycPartnerResponsesPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const [activeTab, setActiveTab] = useState<SupportKycPartnerResponseTabId>("verification");
  const [variantByTab, setVariantByTab] = useState<Partial<Record<SupportKycPartnerResponseTabId, string>>>({});

  const tabData: SupportKycPartnerResponseTab = snapshot.responses[activeTab];

  const selectedVariantId =
    variantByTab[activeTab] && tabData.variants.some((row) => row.id === variantByTab[activeTab])
      ? variantByTab[activeTab]!
      : (tabData.variants[0]?.id ?? "");
  const selectedVariant = tabData.variants.find((row) => row.id === selectedVariantId) ?? tabData.variants[0];

  return (
    <section className={cn("support-client-kyc-partner-responses", className)}>
      <header className="support-client-kyc-partner-responses__header">
        <div className="support-client-kyc-partner-responses__header-row">
          <h2 className="support-client-kyc-partner-responses__title">{copy.partnerResponsesTitle}</h2>
          {tabData.variants.length > 1 ? (
            <PartnerResponseVariantSelect
              label={copy.partnerResponseVariantLabel}
              variants={tabData.variants}
              value={selectedVariantId}
              onChange={(variantId) => setVariantByTab((current) => ({ ...current, [activeTab]: variantId }))}
            />
          ) : null}
        </div>
        <ClientKycPartnerResponseSubTabs value={activeTab} onChange={setActiveTab} />
      </header>

      <div
        id={`client-kyc-partner-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`client-kyc-partner-tab-${activeTab}`}
        className="support-client-kyc-partner-responses__panel"
      >
        {selectedVariant ? (
          <PartnerResponseTabBody tab={activeTab} variant={selectedVariant} copy={copy} />
        ) : (
          <PartnerResponseEmpty copy={copy} />
        )}
      </div>
    </section>
  );
}
