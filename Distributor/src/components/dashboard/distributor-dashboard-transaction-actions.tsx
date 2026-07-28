"use client";

import Link from "next/link";
import { Building2, UserPlus, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";

const ADD_INVESTOR_HREF = "/dashboard/add-investor";
const QUICK_TRANSACTION_HREF = "/dashboard/quick-transaction";
const ADD_DISTRIBUTOR_HREF = "/dashboard/add-distributor";

export function DistributorDashboardTransactionActions() {
  const { isBranchManager } = useDistributorAuth();

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {isBranchManager ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          nativeButton={false}
          render={<Link href={ADD_DISTRIBUTOR_HREF} />}
        >
          <Building2 className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="hidden lg:inline">Add distributor</span>
          <span className="sr-only lg:hidden">Add distributor</span>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        nativeButton={false}
        render={<Link href={ADD_INVESTOR_HREF} />}
      >
        <UserPlus className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="hidden md:inline">Add investor</span>
        <span className="sr-only md:hidden">Add investor</span>
      </Button>
      <Button
        type="button"
        size="sm"
        className="gap-1.5"
        nativeButton={false}
        render={<Link href={QUICK_TRANSACTION_HREF} />}
      >
        <Zap className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="hidden md:inline">Quick transaction</span>
        <span className="sr-only md:hidden">Quick transaction</span>
      </Button>
    </div>
  );
}
