"use client";

import { ClientKycJourneyPanel } from "@/components/clients/client-kyc-journey-panel";
import type { DistributorClientKycStep } from "@/lib/dummy/types";
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
};

export function ClientKycJourneyDialog({
  open,
  onOpenChange,
  steps,
  overallStatus,
  investorType,
}: ClientKycJourneyDialogProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>KYC step completion for this investor.</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="p-5">
          <ClientKycJourneyPanel
            steps={steps}
            overallStatus={overallStatus}
            investorType={investorType}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
