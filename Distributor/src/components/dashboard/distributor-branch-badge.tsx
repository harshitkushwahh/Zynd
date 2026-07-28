"use client";

import { Building2 } from "lucide-react";

import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { cn } from "@/lib/utils";

type DistributorBranchBadgeProps = {
  className?: string;
};

export function DistributorBranchBadge({ className }: DistributorBranchBadgeProps) {
  const { user, branchLabel, isBranchManager } = useDistributorAuth();

  if (!isBranchManager) {
    return null;
  }

  const branchCode = user?.branchCode?.trim();

  return (
    <div
      className={cn("distributor-branch-badge", className)}
      title={branchLabel}
      aria-label={`Branch: ${branchLabel}${branchCode ? ` (${branchCode})` : ""}`}
    >
      <span className="distributor-branch-badge__icon" aria-hidden>
        <Building2 className="size-3.5" strokeWidth={2.25} />
      </span>
      <span className="distributor-branch-badge__body">
        {branchCode ? (
          <span className="distributor-branch-badge__code">{branchCode}</span>
        ) : null}
        <span className="distributor-branch-badge__name">{branchLabel}</span>
      </span>
    </div>
  );
}
