"use client";

import { DistributorInfoBadge } from "@/components/ui/distributor-info-badge";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { formatDistributorBranchName } from "@/lib/distributor-branch-display";
import { cn } from "@/lib/utils";

type DistributorBranchBadgeProps = {
  className?: string;
};

export function DistributorBranchBadge({ className }: DistributorBranchBadgeProps) {
  const { user, branchLabel, isBranchManager } = useDistributorAuth();

  if (!isBranchManager) {
    return null;
  }

  const branchCode = user?.branchCode?.trim() || undefined;
  const displayName = formatDistributorBranchName(branchLabel);

  return (
    <DistributorInfoBadge
      className={cn(className)}
      code={branchCode || undefined}
      label={displayName}
      aria-label={`Branch: ${displayName}${branchCode ? ` (${branchCode})` : ""}`}
    />
  );
}
