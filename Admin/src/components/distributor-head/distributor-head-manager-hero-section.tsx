"use client";

import type { ReactNode } from "react";
import {
  Building2,
  IndianRupee,
  Mail,
  MapPin,
  Network,
  UserRound,
  Users2,
} from "lucide-react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DistributorHeadManager } from "@/lib/dummy/distributor-head-data";
import type { ManagerBookSummary } from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadCount, formatDistributorHeadInr } from "@/lib/distributor-head-format";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

type DistributorHeadManagerHeroSectionProps = {
  manager: DistributorHeadManager;
  branchCount: number;
  distributorCount: number;
  activeDistributors: number;
  pendingManagerLeave: number;
  book: ManagerBookSummary;
  breadcrumb?: ReactNode;
};

export function DistributorHeadManagerHeroSection({
  manager,
  branchCount,
  distributorCount,
  activeDistributors,
  pendingManagerLeave,
  book,
  breadcrumb,
}: DistributorHeadManagerHeroSectionProps) {
  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}

      <Card className="w-full min-w-0 max-w-full overflow-hidden border border-border/80 ring-0">
        <CardContent className="flex w-full min-w-0 flex-col gap-3 p-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Avatar className="size-12 shrink-0 rounded-full sm:size-14">
              <AvatarFallback className="rounded-full text-lg font-semibold">
                {initialsFromName(manager.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 max-w-full truncate font-heading text-xl font-semibold text-foreground">
                  {manager.name}
                </h2>
                <DistributorHeadStatusBadge status={manager.status} />
              </div>
              {pendingManagerLeave > 0 ? (
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  <Badge variant="outline" className="shrink-0 border-warning/40 bg-warning/10 text-warning">
                    {pendingManagerLeave} leave pending
                  </Badge>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-[55%] sm:justify-end">
            <Badge
              variant="outline"
              className="min-w-0 max-w-full shrink gap-1 overflow-hidden font-normal whitespace-normal"
            >
              <Mail className="size-3 shrink-0 opacity-70" />
              <span className="min-w-0 truncate">{manager.email}</span>
            </Badge>
            <Badge
              variant="outline"
              className="min-w-0 max-w-full shrink gap-1 overflow-hidden font-normal whitespace-normal"
            >
              <MapPin className="size-3 shrink-0 opacity-70" />
              <span className="min-w-0 truncate">{manager.city}</span>
            </Badge>
            <Badge variant="secondary" className="shrink-0 gap-1 font-normal">
              <UserRound className="size-3 shrink-0 opacity-80" />
              {MITRA_HIERARCHY_COPY.branchManager}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <AdminMetricCardsGrid className="w-full min-w-0 max-w-full">
        <AdminMetricCard
          label="Total AUM"
          value={formatDistributorHeadInr(book.totalAumInr)}
          hint={`Sales MTD ${formatDistributorHeadInr(book.salesMtdInr)}`}
          icon={IndianRupee}
          tone="success"
          accent
        />
        <AdminMetricCard
          label="Investor clients"
          value={formatDistributorHeadCount(book.totalClients)}
          hint={`${formatDistributorHeadInr(book.sipCommitmentMonthlyInr)}/mo SIP commitment`}
          icon={Users2}
          tone="info"
        />
        <AdminMetricCard
          label="Branches"
          value={formatDistributorHeadCount(branchCount)}
          hint={`Locations this ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} runs`}
          icon={Building2}
          tone="muted"
        />
        <AdminMetricCard
          label={MITRA_HIERARCHY_COPY.zyndMitras}
          value={formatDistributorHeadCount(distributorCount)}
          hint={`${activeDistributors} active on team`}
          icon={Network}
          tone="default"
        />
      </AdminMetricCardsGrid>
    </div>
  );
}
