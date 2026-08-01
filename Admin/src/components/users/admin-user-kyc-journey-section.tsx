"use client";

import { useMemo } from "react";

import { AdminUserKycJourneyFlow } from "@/components/users/admin-user-kyc-journey-flow";
import type { AdminUserKycDetail } from "@/lib/admin-api";
import { buildAdminKycFlowSteps } from "@/lib/admin-user-kyc-steps";
import { cn } from "@/lib/utils";

type AdminUserKycJourneySectionProps = {
  kyc: AdminUserKycDetail;
  className?: string;
};

export function AdminUserKycJourneySection({ kyc, className }: AdminUserKycJourneySectionProps) {
  const steps = useMemo(() => buildAdminKycFlowSteps(kyc), [kyc]);
  const kycCompliant = kyc.kyc_already_registered ?? false;

  return (
    <div className={cn("admin-user-kyc-journey", className)}>
      <AdminUserKycJourneyFlow steps={steps} kycCompliant={kycCompliant} />
    </div>
  );
}
