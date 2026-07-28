"use client";

import { ArrowLeftRight, IndianRupee, PieChart, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DUMMY_BRANCHES,
  DUMMY_SALES_ROWS,
  DUMMY_STATE_HEAD,
  sumBranchesAum,
} from "@/lib/dummy/distributor-head-data";
import {
  formatDistributorHeadCount,
  formatDistributorHeadInr,
} from "@/lib/distributor-head-format";

export function DistributorHeadStateTotalsCard() {
  const bookAum = sumBranchesAum();
  const activeClients = DUMMY_BRANCHES.reduce((sum, branch) => sum + branch.activeClients, 0);
  const latestSales = DUMMY_SALES_ROWS[0];
  const transactionCount = latestSales?.transactionCount ?? 0;

  return (
    <Card className="distributor-head-state-totals h-fit overflow-hidden">
      <CardHeader className="distributor-head-state-totals__header space-y-2 border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">State totals</CardTitle>
          <Badge variant="outline" className="shrink-0 font-normal text-micro">
            Demo
          </Badge>
        </div>
        <p className="text-caption text-muted-foreground">
          {DUMMY_STATE_HEAD.state} · {DUMMY_BRANCHES.length} branches
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-4">
        <div className="distributor-head-state-totals__hero">
          <div className="distributor-head-state-totals__hero-icon">
            <IndianRupee className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">Book AUM (branches)</p>
            <p className="font-heading text-h3 font-semibold tabular-nums tracking-tight text-foreground">
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
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {formatDistributorHeadCount(activeClients)}
              </p>
            </div>
          </div>

          <div className="distributor-head-state-totals__row">
            <div className="distributor-head-state-totals__row-icon distributor-head-state-totals__row-icon--success">
              <ArrowLeftRight className="size-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-caption text-muted-foreground">Latest month transactions</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {formatDistributorHeadCount(transactionCount)}
              </p>
              {latestSales ? (
                <p className="mt-0.5 flex items-center gap-1 text-micro text-muted-foreground">
                  <PieChart className="size-3 shrink-0 opacity-70" />
                  {latestSales.periodLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
