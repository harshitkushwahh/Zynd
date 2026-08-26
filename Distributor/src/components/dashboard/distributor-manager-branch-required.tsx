"use client";

import type { ReactNode } from "react";
import { Building2 } from "lucide-react";

import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

type DistributorManagerBranchRequiredProps = {
  children: ReactNode;
  className?: string;
};

export function DistributorManagerBranchRequired({
  children,
  className,
}: DistributorManagerBranchRequiredProps) {
  const { loading, canManageBranchBook } = useDistributorAuth();

  if (loading) return null;
  if (canManageBranchBook) return <>{children}</>;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-muted/10 p-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
          <Building2 className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-compact font-semibold text-foreground">
            {ZYND_MITRA_COPY.branchAssignmentRequiredTitle}
          </p>
          <p className="text-caption text-muted-foreground">
            {ZYND_MITRA_COPY.branchAssignmentRequiredDesc}
          </p>
        </div>
      </div>
    </div>
  );
}
