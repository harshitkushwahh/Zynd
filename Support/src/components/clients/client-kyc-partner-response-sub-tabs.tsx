"use client";

import {
  BadgeCheck,
  Building2,
  FileSignature,
  Fingerprint,
  Landmark,
  type LucideIcon,
} from "lucide-react";

import { CLIENT_KYC_PARTNER_RESPONSE_TAB_IDS } from "@/components/clients/client-kyc-partner-response-sub-tab-ids";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { SupportKycPartnerResponseTabId } from "@/lib/support-client-kyc-partner-model";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<SupportKycPartnerResponseTabId, LucideIcon> = {
  verification: Fingerprint,
  digilocker: BadgeCheck,
  bank: Building2,
  ifsc: Landmark,
  esign: FileSignature,
};

type ClientKycPartnerResponseSubTabsProps = {
  value: SupportKycPartnerResponseTabId;
  onChange: (tabId: SupportKycPartnerResponseTabId) => void;
  className?: string;
};

export function ClientKycPartnerResponseSubTabs({
  value,
  onChange,
  className,
}: ClientKycPartnerResponseSubTabsProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;

  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs support-client-kyc-partner-responses__tabs", className)}
      role="tablist"
      aria-label={copy.partnerResponsesSubTabsAriaLabel}
    >
      {CLIENT_KYC_PARTNER_RESPONSE_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = TAB_ICONS[tabId];
        const label = copy.partnerResponsesSubTabs[tabId];
        return (
          <button
            key={tabId}
            id={`client-kyc-partner-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`client-kyc-partner-panel-${tabId}`}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
