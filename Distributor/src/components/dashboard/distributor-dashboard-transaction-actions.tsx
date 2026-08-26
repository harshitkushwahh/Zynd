"use client";

import Link from "next/link";
import { Building2, UserPlus, Zap } from "lucide-react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const ADD_INVESTOR_HREF = "/dashboard/add-investor";
const QUICK_TRANSACTION_HREF = "/dashboard/quick-transaction";
const ADD_DISTRIBUTOR_HREF = "/dashboard/add-distributor";

export function DistributorDashboardTransactionActions() {
  const { isBranchManager, canManageBranchBook } = useDistributorAuth();

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {isBranchManager && canManageBranchBook ? (
        <DistributorActionButton
          variant="outline"
          nativeButton={false}
          render={<Link href={ADD_DISTRIBUTOR_HREF} />}
        >
          <Building2 className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="hidden lg:inline">{ZYND_MITRA_COPY.add}</span>
          <span className="sr-only lg:hidden">{ZYND_MITRA_COPY.add}</span>
        </DistributorActionButton>
      ) : null}
      {canManageBranchBook ? (
        <DistributorActionButton
          variant="outline"
          nativeButton={false}
          render={<Link href={ADD_INVESTOR_HREF} />}
        >
          <UserPlus className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="hidden md:inline">Add investor</span>
          <span className="sr-only md:hidden">Add investor</span>
        </DistributorActionButton>
      ) : null}
      <DistributorActionButton
        variant="primary"
        nativeButton={false}
        render={<Link href={QUICK_TRANSACTION_HREF} />}
      >
        <Zap className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="hidden md:inline">Quick transaction</span>
        <span className="sr-only md:hidden">Quick transaction</span>
      </DistributorActionButton>
    </div>
  );
}
