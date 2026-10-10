"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Database, FileJson } from "lucide-react";

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
import { kycPayloadObjectLabel } from "@/lib/kyc-payload-preview";
import type { SupportKycRegistryRecord } from "@/lib/support-client-kyc-registry-model";
import { cn } from "@/lib/utils";

type RegistrySourceTab = "partner" | "system";

function RegistrySourceTabs({
  value,
  onChange,
}: {
  value: RegistrySourceTab;
  onChange: (tab: RegistrySourceTab) => void;
}) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const tabs: RegistrySourceTab[] = ["partner", "system"];

  return (
    <div
      className="support-client-kyc-registry__source-tabs"
      role="tablist"
      aria-label={copy.registrySourceTabsAriaLabel}
    >
      {tabs.map((tabId) => {
        const active = value === tabId;
        return (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "support-client-kyc-registry__source-tab",
              active && "support-client-kyc-registry__source-tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            {copy.registrySourceTabs[tabId]}
          </button>
        );
      })}
    </div>
  );
}

type ClientKycRegistryRecordCardProps = {
  record: SupportKycRegistryRecord;
  icon: LucideIcon;
  className?: string;
};

export function ClientKycRegistryRecordCard({ record, icon: Icon, className }: ClientKycRegistryRecordCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const [variantId, setVariantId] = useState(record.variants[0]?.id ?? "");
  const [sourceTab, setSourceTab] = useState<RegistrySourceTab>("partner");
  const variant =
    record.variants.find((row) => row.id === variantId) ?? record.variants[0] ?? null;

  const selectedVariantOption = record.variants.find((row) => row.id === variantId);

  const payload =
    variant && sourceTab === "partner" ? variant.partnerResponse : variant?.systemStored ?? {};
  const payloadTitle =
    sourceTab === "partner" ? copy.registryPartnerResponseTitle : copy.registrySystemStoredTitle;
  const payloadIcon = sourceTab === "partner" ? FileJson : Database;
  const objectLabel = kycPayloadObjectLabel(payload);
  const primarySummary = variant?.summaryFields.find((field) => field.value)?.value ?? objectLabel;

  return (
    <article className={cn("support-client-kyc-registry__card", className)}>
      <header className="support-client-kyc-registry__card-head">
        <div className="support-client-kyc-registry__title-bar">
          <div className="support-client-kyc-registry__card-title-row">
            <span className="support-client-kyc-registry__card-icon" aria-hidden>
              <Icon strokeWidth={2.1} />
            </span>
            <h3 className="support-client-kyc-registry__card-title">{record.title}</h3>
          </div>
          <RegistrySourceTabs value={sourceTab} onChange={setSourceTab} />
        </div>
        {record.variants.length > 0 && variant ? (
          <SupportSelect value={variant.id} onValueChange={(next) => next && setVariantId(next)}>
            <SupportSelectTrigger className="support-client-kyc-registry__variant-trigger">
              <SupportSelectValue placeholder={copy.registryVariantLabel}>
                {selectedVariantOption?.label ?? variant.label}
              </SupportSelectValue>
            </SupportSelectTrigger>
            <SupportSelectContent className={SUPPORT_SELECT_CONTENT_CLASS}>
              {record.variants.map((row) => (
                <SupportSelectItem key={row.id} value={row.id}>
                  {row.label}
                </SupportSelectItem>
              ))}
            </SupportSelectContent>
          </SupportSelect>
        ) : null}
      </header>

      {variant ? (
        <>
          <dl className="support-client-kyc-registry__summary">
            {variant.summaryFields.map((field) =>
              field.value ? (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ) : null,
            )}
          </dl>
          <ClientKycPayloadOpenCard
            title={payloadTitle}
            subtitle={primarySummary}
            dialogTitle={`${record.title} · ${payloadTitle}`}
            dialogDescription={copy.payloadDialogDescription}
            dialogIcon={payloadIcon}
            metaRows={variant.summaryFields
              .filter((field) => field.value)
              .map((field) => ({ label: field.label, value: field.value! }))}
            payload={payload}
          />
        </>
      ) : null}
    </article>
  );
}
