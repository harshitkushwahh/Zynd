"use client";

import { ClientKycAuditLogPanel } from "@/components/clients/client-kyc-audit-log-panel";
import { ClientKycJourneyFlow } from "@/components/clients/client-kyc-journey-flow";
import { ClientKycJourneySummaryCard } from "@/components/clients/client-kyc-journey-summary-card";
import { ClientKycPartnerResponsesPanel } from "@/components/clients/client-kyc-partner-responses-panel";
import { ClientKycRegistryPanel } from "@/components/clients/client-kyc-registry-panel";
import { ClientKycVerificationStatusCards } from "@/components/clients/client-kyc-verification-status-cards";
import type { DistributorClientKycAuditEntry, DistributorClientKycStep } from "@/lib/distributor-types";
import type { SupportClientKycPartnerSnapshot } from "@/lib/support-client-kyc-partner-model";
import type { SupportClientKycRegistrySnapshot } from "@/lib/support-client-kyc-registry-model";
import { cn } from "@/lib/utils";

type ClientKycJourneyPanelProps = {
  steps: DistributorClientKycStep[];
  overallStatus: string;
  investorType?: string;
  kycCompliant?: boolean;
  kycInitiatedAt: string;
  kycAuditLog: DistributorClientKycAuditEntry[];
  kycPartnerSnapshot?: SupportClientKycPartnerSnapshot | null;
  kycRegistrySnapshot?: SupportClientKycRegistrySnapshot | null;
  className?: string;
};

export function ClientKycJourneyPanel({
  steps,
  kycCompliant = false,
  kycInitiatedAt,
  kycAuditLog,
  kycPartnerSnapshot,
  kycRegistrySnapshot,
  className,
}: ClientKycJourneyPanelProps) {
  return (
    <div className={cn("distributor-client-kyc-journey", className)}>
      <ClientKycJourneySummaryCard
        steps={steps}
        kycInitiatedAt={kycInitiatedAt}
        kycCompliant={kycCompliant}
      />
      <ClientKycJourneyFlow steps={steps} kycCompliant={kycCompliant} />
      {kycPartnerSnapshot ? (
        <>
          <ClientKycVerificationStatusCards cards={kycPartnerSnapshot.verificationCards} />
          <ClientKycPartnerResponsesPanel snapshot={kycPartnerSnapshot} />
        </>
      ) : null}
      {kycRegistrySnapshot ? <ClientKycRegistryPanel snapshot={kycRegistrySnapshot} /> : null}
      <ClientKycAuditLogPanel entries={kycAuditLog} />
    </div>
  );
}
