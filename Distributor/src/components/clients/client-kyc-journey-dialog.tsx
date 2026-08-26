"use client";

import { ClientKycJourneyPanel } from "@/components/clients/client-kyc-journey-panel";
import type { DistributorClientKycAuditEntry, DistributorClientKycStep } from "@/lib/distributor-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";

type ClientKycJourneyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: DistributorClientKycStep[];
  overallStatus: string;
  investorType?: string;
  kycCompliant?: boolean;
  kycInitiatedAt?: string;
  kycAuditLog?: DistributorClientKycAuditEntry[];
};

export function ClientKycJourneyDialog({
  open,
  onOpenChange,
  steps,
  overallStatus,
  investorType,
  kycCompliant = false,
  kycInitiatedAt,
  kycAuditLog = [],
}: ClientKycJourneyDialogProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>KYC step completion for this investor.</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-h-[min(90vh,44rem)] max-w-3xl gap-0 overflow-y-auto p-0">
        <div className="p-5">
          <ClientKycJourneyPanel
            steps={steps}
            overallStatus={overallStatus}
            investorType={investorType}
            kycCompliant={kycCompliant}
            kycInitiatedAt={kycInitiatedAt ?? new Date().toISOString()}
            kycAuditLog={kycAuditLog}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
