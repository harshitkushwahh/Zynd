"use client";

import { useState } from "react";
import { ChevronRight, Gift, Target, TrendingUp } from "lucide-react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DistributorHeadManagerIncentive } from "@/lib/dummy/distributor-head-data";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";
import { cn } from "@/lib/utils";

const TIER_CLASS: Record<DistributorHeadManagerIncentive["tier"], string> = {
  Bronze: "border-amber-700/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  Silver: "border-border bg-muted/50 text-muted-foreground",
  Gold: "border-warning/30 bg-warning/10 text-warning",
  Platinum: "border-primary/30 bg-primary/10 text-primary",
};

function IncentiveDetailBody({ incentive }: { incentive: DistributorHeadManagerIncentive }) {
  const gap = incentive.achievedSalesInr - incentive.targetSalesInr;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("font-medium capitalize", TIER_CLASS[incentive.tier])}>
          {incentive.tier} tier
        </Badge>
        <DistributorHeadStatusBadge status={incentive.status} />
        <Badge variant="secondary" className="tabular-nums font-medium">
          {incentive.attainmentPct}% attainment
        </Badge>
      </div>

      <dl className="divide-y divide-border rounded-md border border-border text-compact">
        <div className="flex items-center justify-between gap-4 px-3 py-2.5">
          <dt className="text-muted-foreground">Period</dt>
          <dd className="font-medium text-foreground">{incentive.periodLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2.5">
          <dt className="text-muted-foreground">Sales target</dt>
          <dd className="font-semibold tabular-nums">{formatDistributorHeadInr(incentive.targetSalesInr)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2.5">
          <dt className="text-muted-foreground">Achieved MTD</dt>
          <dd className="font-semibold tabular-nums">{formatDistributorHeadInr(incentive.achievedSalesInr)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2.5">
          <dt className="text-muted-foreground">Vs target</dt>
          <dd
            className={cn(
              "font-semibold tabular-nums",
              gap >= 0 ? "text-success" : "text-warning",
            )}
          >
            {gap >= 0 ? "+" : ""}
            {formatDistributorHeadInr(gap)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2.5">
          <dt className="text-muted-foreground">Estimated payout</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {incentive.payoutInr > 0 ? formatDistributorHeadInr(incentive.payoutInr) : "—"}
          </dd>
        </div>
      </dl>

      <p className="text-caption text-muted-foreground">
        Demo only: payout uses tier multiplier on eligible sales above branch minimums. Final numbers
        are reconciled after month-end audit.
      </p>
    </div>
  );
}

export function DistributorHeadManagerIncentivesCard({
  incentive,
}: {
  incentive: DistributorHeadManagerIncentive | undefined;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (!incentive) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Gift className="size-4 text-primary" />
            Incentives
          </CardTitle>
        </CardHeader>
        <CardContent className="text-compact text-muted-foreground">
          No incentive plan on file for this manager (demo).
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-full overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Gift className="size-4 text-primary" />
                Incentives
              </CardTitle>
              <p className="mt-1 text-caption text-muted-foreground">{incentive.periodLabel}</p>
            </div>
            <Badge variant="outline" className={cn("font-medium capitalize", TIER_CLASS[incentive.tier])}>
              {incentive.tier}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <DistributorHeadStatusBadge status={incentive.status} />
            <Badge variant="secondary" className="tabular-nums font-medium">
              {incentive.attainmentPct}% of target
            </Badge>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <Target className="size-3.5" />
                Sales target
              </dt>
              <dd className="mt-1 font-semibold tabular-nums text-foreground">
                {formatDistributorHeadInr(incentive.targetSalesInr)}
              </dd>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <TrendingUp className="size-3.5" />
                Achieved MTD
              </dt>
              <dd className="mt-1 font-semibold tabular-nums text-foreground">
                {formatDistributorHeadInr(incentive.achievedSalesInr)}
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-2 rounded-md border border-success/25 bg-success/5 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-caption text-muted-foreground">Estimated payout (demo)</p>
              <p className="font-heading text-lg font-semibold tabular-nums text-foreground">
                {incentive.payoutInr > 0 ? formatDistributorHeadInr(incentive.payoutInr) : "—"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-full"
              aria-label="View incentive details"
              onClick={() => setDetailOpen(true)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AdminDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Incentive detail"
        description={incentive.periodLabel}
        icon={Gift}
        iconTone="info"
        size="sm"
      >
        <IncentiveDetailBody incentive={incentive} />
      </AdminDetailDialog>
    </>
  );
}
