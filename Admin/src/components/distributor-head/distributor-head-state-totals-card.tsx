"use client";

import { ArrowLeftRight, IndianRupee, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AdminHierarchyBranch,
  AdminHierarchyOverview,
} from "@/lib/admin-distributor-hierarchy-api";
import {
  formatDistributorHeadCount,
  formatDistributorHeadInr,
} from "@/lib/distributor-head-format";

type DistributorHeadStateTotalsCardProps = {
  overview: AdminHierarchyOverview | null;
  branches: AdminHierarchyBranch[];
};

export function DistributorHeadStateTotalsCard({
  overview,
  branches,
}: DistributorHeadStateTotalsCardProps) {
  const bookAum = branches.reduce((sum, branch) => sum + branch.aum_inr, 0);
  const activeClients = branches.reduce((sum, branch) => sum + branch.active_clients, 0);
  const pendingReview = overview?.pending_review_count ?? 0;

  return (
    <Card className="distributor-head-overview-card distributor-head-state-totals h-fit min-w-0 border border-border shadow-none ring-0">
      <CardHeader className="distributor-head-state-totals__header space-y-2 border-b border-border/60 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">State totals</CardTitle>
        </div>
        <p className="text-caption text-muted-foreground">
          {overview?.state_name ?? "State"} · {overview?.branch_count ?? branches.length} branches
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-3 sm:p-4">
        <div className="distributor-head-state-totals__hero">
          <div className="distributor-head-state-totals__hero-icon">
            <IndianRupee className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">Book AUM (branches)</p>
            <p className="font-heading text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
              {formatDistributorHeadInr(bookAum)}
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="distributor-head-state-totals__row">
            <div className="distributor-head-state-totals__row-icon distributor-head-state-totals__row-icon--info">
              <Users className="size-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-caption text-muted-foreground">Clients (active)</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {formatDistributorHeadCount(activeClients)}
              </p>
            </div>
          </div>

          <div className="distributor-head-state-totals__row">
            <div className="distributor-head-state-totals__row-icon distributor-head-state-totals__row-icon--success">
              <ArrowLeftRight className="size-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-caption text-muted-foreground">Pending HO review</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {formatDistributorHeadCount(pendingReview)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
