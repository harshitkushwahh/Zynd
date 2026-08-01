"use client";

import { Card } from "@/components/ui/card";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";

type BranchManagerPlaceholderPanelProps = DistributorPageConfig & {
  bullets: string[];
};

export function BranchManagerPlaceholderPanel({
  title,
  description,
  bullets,
}: BranchManagerPlaceholderPanelProps) {
  const { branchLabel } = useDistributorAuth();

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        title={title}
        description={`${description} Scope: ${branchLabel}.`}
      />
      <Card className="border-dashed p-6">
        <p className="text-compact font-medium text-foreground">Coming soon in demo</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-caption text-muted-foreground">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
