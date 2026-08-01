"use client";

import Link from "next/link";
import { Building2, IndianRupee, Mail, MapPin, UserRound, Users2 } from "lucide-react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DUMMY_STATE_HEAD,
  type DistributorHeadDistributor,
} from "@/lib/dummy/distributor-head-data";
import {
  distributorHeadManagerHref,
  getDistributorHeadManager,
} from "@/lib/distributor-head-queries";
import { formatDistributorHeadCount, formatDistributorHeadInr } from "@/lib/distributor-head-format";

type DistributorHeadDistributorDetailProps = {
  distributor: DistributorHeadDistributor;
};

export function DistributorHeadDistributorDetail({ distributor }: DistributorHeadDistributorDetailProps) {
  const manager = getDistributorHeadManager(distributor.managerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-xl font-semibold text-foreground">{distributor.name}</h2>
            <DistributorHeadStatusBadge status={distributor.status} />
          </div>
          <p className="font-mono text-compact text-muted-foreground">{distributor.arn}</p>
          <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <Mail className="size-3.5" />
            {distributor.email}
          </p>
        </div>
      </div>

      <AdminMetricCardsGrid>
        <AdminMetricCard
          label="Investor clients"
          value={formatDistributorHeadCount(distributor.clientCount)}
          hint="Active relationships on Zynd"
          icon={Users2}
          tone="success"
        />
        <AdminMetricCard
          label="Book AUM"
          value={formatDistributorHeadInr(distributor.aumInr)}
          hint="Mark-to-market demo value"
          icon={IndianRupee}
          tone="info"
        />
        <AdminMetricCard
          label="Sales MTD"
          value={formatDistributorHeadInr(distributor.salesMtdInr)}
          hint="Flows attributed this month"
          icon={IndianRupee}
          tone="default"
        />
        <AdminMetricCard
          label="Branch"
          value={distributor.branchName}
          hint={distributor.branchName}
          icon={Building2}
          tone="muted"
        />
      </AdminMetricCardsGrid>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Reporting line</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3 text-compact">
            <li className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
              <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">{DUMMY_STATE_HEAD.name}</p>
                <p className="text-caption text-muted-foreground">State head · {DUMMY_STATE_HEAD.state}</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2.5">
              <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                {manager ? (
                  <>
                    <Link
                      href={distributorHeadManagerHref(manager.id)}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {manager.name}
                    </Link>
                    <p className="text-caption text-muted-foreground">
                      Branch manager · coaches this distributor
                    </p>
                  </>
                ) : (
                  <p className="font-medium">{distributor.managerName}</p>
                )}
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-md border border-primary/25 bg-primary/5 px-3 py-2.5">
              <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">{distributor.name}</p>
                <p className="text-caption text-muted-foreground">
                  Distributor · client acquisition & order placement
                </p>
              </div>
            </li>
          </ol>
          <p className="text-caption text-muted-foreground">
            Day to day, {distributor.name} executes transactions for investors at{" "}
            <span className="font-medium text-foreground">{distributor.branchName}</span>.{" "}
            {manager?.name ?? distributor.managerName} reviews pipeline, leave, and onboarding;{" "}
            {DUMMY_STATE_HEAD.name} sees aggregated sales and AUM for Maharashtra.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Branch assignment</CardTitle>
        </CardHeader>
        <CardContent className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MapPin className="size-4" />
          </div>
          <div>
            <p className="font-medium text-foreground">{distributor.branchName}</p>
            <p className="text-caption text-muted-foreground">
              Primary office for client meetings and branch ops sync.
            </p>
            {manager ? (
              <Link
                href={distributorHeadManagerHref(manager.id)}
                className="mt-1 inline-block text-compact text-primary underline-offset-4 hover:underline"
              >
                View manager · {manager.name}
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
