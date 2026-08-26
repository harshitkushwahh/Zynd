"use client";

import { Building2 } from "lucide-react";

import { DistributorHeadChipBadge } from "@/components/distributor-head/distributor-head-badge";
import { DistributorHeadManagerIncentivesCard } from "@/components/distributor-head/distributor-head-manager-incentives-card";
import { DistributorHeadManagerLeavePanel } from "@/components/distributor-head/distributor-head-manager-leave-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  DistributorHeadBranch,
  DistributorHeadLeaveApplication,
  DistributorHeadManagerIncentive,
} from "@/lib/dummy/distributor-head-data";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadCount, formatDistributorHeadInr } from "@/lib/distributor-head-format";

type DistributorHeadManagerOverviewPanelProps = {
  branches: DistributorHeadBranch[];
  leaveItems: DistributorHeadLeaveApplication[];
  incentive: DistributorHeadManagerIncentive | undefined;
};

export function DistributorHeadManagerOverviewPanel({
  branches,
  leaveItems,
  incentive,
}: DistributorHeadManagerOverviewPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid min-w-0 gap-4 overflow-visible px-0.5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DistributorHeadManagerIncentivesCard incentive={incentive} />
        </div>
        <div className="lg:col-span-3">
          <DistributorHeadManagerLeavePanel items={leaveItems} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {branches.map((branch) => (
          <Card key={branch.id} className="border-border/80">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{branch.name}</p>
                  <DistributorHeadChipBadge className="text-muted-foreground">
                    {branch.city}
                  </DistributorHeadChipBadge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="tabular-nums font-normal">
                    {branch.distributorCount} {MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()}
                  </Badge>
                  <Badge variant="outline" className="tabular-nums font-normal">
                    {formatDistributorHeadCount(branch.activeClients)} clients
                  </Badge>
                  <Badge variant="secondary" className="tabular-nums font-normal">
                    AUM {formatDistributorHeadInr(branch.aumInr)}
                  </Badge>
                  <Badge variant="secondary" className="tabular-nums font-normal">
                    MTD {formatDistributorHeadInr(branch.salesMtdInr)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
