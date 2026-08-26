"use client";

import { ClientKycAuditLogPanel } from "@/components/clients/client-kyc-audit-log-panel";
import { ClientKycJourneyFlow } from "@/components/clients/client-kyc-journey-flow";
import { ClientKycJourneySummaryCard } from "@/components/clients/client-kyc-journey-summary-card";
import type { DistributorClientKycAuditEntry, DistributorClientKycStep } from "@/lib/distributor-types";
import { cn } from "@/lib/utils";

type ClientKycJourneyPanelProps = {
  steps: DistributorClientKycStep[];
  overallStatus: string;
  investorType?: string;
  kycCompliant?: boolean;
  kycInitiatedAt: string;
  kycAuditLog: DistributorClientKycAuditEntry[];
  className?: string;
};

export function ClientKycJourneyPanel({
  steps,
  kycCompliant = false,
  kycInitiatedAt,
  kycAuditLog,
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
      <ClientKycAuditLogPanel entries={kycAuditLog} />
    </div>
  );
}
