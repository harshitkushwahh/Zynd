"use client";

import { useMemo } from "react";

import { AdminUserKycJourneyFlow } from "@/components/users/admin-user-kyc-journey-flow";
import type { AdminUserKycDetail } from "@/lib/admin-api";
import {
  buildAdminKycFlowSteps,
  isAdminKycKraPath,
  kycApplicableSteps,
} from "@/lib/admin-user-kyc-steps";
import { cn } from "@/lib/utils";

type AdminUserKycJourneySectionProps = {
  kyc: AdminUserKycDetail;
  className?: string;
};

export function AdminUserKycJourneySection({ kyc, className }: AdminUserKycJourneySectionProps) {
  const steps = useMemo(() => kycApplicableSteps(buildAdminKycFlowSteps(kyc)), [kyc]);
  const kycCompliant = isAdminKycKraPath(kyc);

  return (
    <div className={cn("admin-user-kyc-journey", className)}>
      <AdminUserKycJourneyFlow steps={steps} kycCompliant={kycCompliant} />
    </div>
  );
}
