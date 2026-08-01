"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";

import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export function AddDistributorPlaceholderPage() {
  const { branchLabel } = useDistributorAuth();

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        title={ZYND_MITRA_COPY.add}
        description={`${ZYND_MITRA_COPY.onboardNew} ${branchLabel}. Full wizard will mirror ARN registration, bank, and compliance checks.`}
      />
      <Card className="p-6">
        <p className="text-compact text-muted-foreground">
          Demo placeholder — wire this to branch-scoped invite API when backend is ready.
        </p>
        <Button type="button" className="mt-4" nativeButton={false} render={<Link href="/dashboard/dist-management/distributors" />}>
          {ZYND_MITRA_COPY.viewBranchMitras}
        </Button>
      </Card>
    </div>
  );
}
