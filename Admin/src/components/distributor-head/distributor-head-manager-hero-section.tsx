"use client";

import { Building2, CalendarClock, IndianRupee, Network, Repeat, Users2 } from "lucide-react";

import {
  DistributorHeadStatusBadge,
} from "@/components/distributor-head/distributor-head-badge";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DUMMY_STATE_HEAD, type DistributorHeadManager } from "@/lib/dummy/distributor-head-data";
import type { ManagerBookSummary } from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadCount, formatDistributorHeadInr } from "@/lib/distributor-head-format";
import { Mail, MapPin } from "lucide-react";

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
};

export function DistributorHeadManagerHeroSection({
  manager,
  branchCount,
  distributorCount,
  activeDistributors,
  pendingManagerLeave,
  book,
}: DistributorHeadManagerHeroSectionProps) {
  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5">
          <Avatar className="size-14 shrink-0 rounded-xl">
            <AvatarFallback className="rounded-xl bg-primary/10 text-lg font-semibold text-primary">
              {initialsFromName(manager.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-semibold text-foreground">{manager.name}</h2>
              <DistributorHeadStatusBadge status={manager.status} />
              {pendingManagerLeave > 0 ? (
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                  {pendingManagerLeave} leave pending
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1 font-normal">
                <Mail className="size-3 opacity-70" />
                {manager.email}
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                <MapPin className="size-3 opacity-70" />
                {manager.city}
              </Badge>
              <Badge variant="secondary" className="font-normal">
                Reports to {DUMMY_STATE_HEAD.name}
              </Badge>
              <Badge variant="outline" className="font-normal tabular-nums">
                {branchCount} branches · {distributorCount} {MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <AdminMetricCardsGrid>
        <AdminMetricCard
          label="Total AUM"
          value={formatDistributorHeadInr(book.totalAumInr)}
          hint={`Across ${MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()} books`}
          icon={IndianRupee}
          tone="success"
          accent
        />
        <AdminMetricCard
          label="Active SIPs"
          value={formatDistributorHeadCount(book.activeSipCount)}
          hint={`${formatDistributorHeadInr(book.sipCommitmentMonthlyInr)}/mo commitment`}
          icon={Repeat}
          tone="info"
        />
        <AdminMetricCard
          label="Lumpsum MTD"
          value={formatDistributorHeadInr(book.lumpsumMtdInr)}
          hint={`SIP MTD ${formatDistributorHeadInr(book.sipMtdInr)}`}
          icon={IndianRupee}
          tone="default"
        />
        <AdminMetricCard
          label="Investor clients"
          value={formatDistributorHeadCount(book.totalClients)}
          hint={`${activeDistributors} active ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()}`}
          icon={Users2}
          tone="muted"
        />
        <AdminMetricCard
          label="Sales MTD"
          value={formatDistributorHeadInr(book.salesMtdInr)}
          hint={`YTD ${formatDistributorHeadInr(manager.salesYtdInr)}`}
          icon={CalendarClock}
          tone="default"
        />
        <AdminMetricCard
          label="Branches"
          value={formatDistributorHeadCount(branchCount)}
          hint={`Locations this ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} runs`}
          icon={Building2}
          tone="info"
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
