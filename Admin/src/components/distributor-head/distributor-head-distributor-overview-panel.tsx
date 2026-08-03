"use client";

import Link from "next/link";
import { Building2, MapPin } from "lucide-react";

import { DistributorHeadDistributorAumChart } from "@/components/distributor-head/distributor-head-distributor-aum-chart";
import {
  DistributorHeadDistributorReportingLine,
} from "@/components/distributor-head/distributor-head-distributor-hero-section";
import { Card, CardContent } from "@/components/ui/card";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import type {
  DistributorHeadAumTrendPoint,
  DistributorHeadBookHolding,
  DistributorHeadDistributor,
} from "@/lib/dummy/distributor-head-data";
import { distributorHeadManagerHref } from "@/lib/distributor-head-queries";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";

const HOLDINGS_COLUMNS = 4;

export function DistributorHeadDistributorOverviewPanel({
  distributor,
  managerName,
  managerId,
  aumTrend,
  holdings,
}: {
  distributor: DistributorHeadDistributor;
  managerName: string;
  managerId: string;
  aumTrend: DistributorHeadAumTrendPoint[];
  holdings: DistributorHeadBookHolding[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DistributorHeadDistributorReportingLine
            distributor={distributor}
            managerName={managerName}
            managerId={managerId}
          />
        </div>
        <div className="lg:col-span-3">
          <DistributorHeadDistributorAumChart points={aumTrend} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/80 lg:col-span-1">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapPin className="size-4" />
            </div>
            <div>
              <p className="font-medium text-foreground">Branch assignment</p>
              <p className="mt-1 text-compact text-foreground">{distributor.branchName}</p>
              <p className="mt-1 text-caption text-muted-foreground">
                Primary office for client meetings and branch ops sync.
              </p>
              <Link
                href={distributorHeadManagerHref(managerId)}
                className="mt-2 inline-flex items-center gap-1.5 text-compact text-primary underline-offset-4 hover:underline"
              >
                <Building2 className="size-3.5" />
                View manager · {managerName}
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <AdminDataTable minWidth="3xl">
            <AdminTableHeader>
              <tr>
                <AdminTableHeadCell>Scheme</AdminTableHeadCell>
                <AdminTableHeadCell>AMC</AdminTableHeadCell>
                <AdminTableHeadCell>AUM</AdminTableHeadCell>
                <AdminTableHeadCell>SIP share</AdminTableHeadCell>
              </tr>
            </AdminTableHeader>
            <AdminTableBody>
              {holdings.length === 0 ? (
                <AdminTableStateRow colSpan={HOLDINGS_COLUMNS}>
                  No holdings data for this distributor.
                </AdminTableStateRow>
              ) : (
                holdings.map((row) => (
                  <AdminTableRow key={row.id}>
                    <AdminTableCell className="font-medium">{row.schemeName}</AdminTableCell>
                    <AdminTableCell className="text-muted-foreground">{row.amcName}</AdminTableCell>
                    <AdminTableCell className="tabular-nums">
                      {formatDistributorHeadInr(row.aumInr)}
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">{row.sipSharePct}%</AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminDataTable>
        </div>
      </div>
    </div>
  );
}
