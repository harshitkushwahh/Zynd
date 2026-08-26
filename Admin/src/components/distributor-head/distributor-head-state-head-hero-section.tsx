"use client";

import type { ReactNode } from "react";
import {
  Building2,
  Crown,
  IndianRupee,
  Mail,
  MapPin,
  Network,
  Users2,
} from "lucide-react";

import { DistributorHeadStateHeadActions } from "@/components/distributor-head/distributor-head-state-head-actions";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminHierarchyStateHead } from "@/lib/admin-distributor-hierarchy-api";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadCount, formatDistributorHeadInr } from "@/lib/distributor-head-format";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

type DistributorHeadStateHeadHeroSectionProps = {
  stateHead: AdminHierarchyStateHead;
  activeManagerCount: number;
  branchCount: number;
  partnerCount: number;
  activePartnerCount: number;
  clientCount: number;
  aumInr: number;
  salesMtdInr: number;
  pendingBranchCount: number;
  unassignedBranchCount: number;
  pendingLeaveCount: number;
  breadcrumb?: ReactNode;
  canManage?: boolean;
  onUpdated?: (next: AdminHierarchyStateHead) => void;
  onUnassigned?: (stateCode: string, stateName: string) => void;
};

export function DistributorHeadStateHeadHeroSection({
  stateHead,
  activeManagerCount,
  branchCount,
  partnerCount,
  activePartnerCount,
  clientCount,
  aumInr,
  salesMtdInr,
  pendingBranchCount,
  unassignedBranchCount,
  pendingLeaveCount,
  breadcrumb,
  canManage = false,
  onUpdated,
  onUnassigned,
}: DistributorHeadStateHeadHeroSectionProps) {
  const isPaused = stateHead.status === "paused";
  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}

      <Card className="w-full min-w-0 max-w-full overflow-hidden border border-border/80 ring-0">
        <CardContent className="flex w-full min-w-0 flex-col gap-3 p-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Avatar className="size-12 shrink-0 rounded-full sm:size-14">
              <AvatarFallback className="rounded-full text-lg font-semibold">
                {initialsFromName(stateHead.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 max-w-full truncate font-heading text-xl font-semibold text-foreground">
                  {stateHead.name}
                </h2>
                {isPaused ? (
                  <Badge variant="outline" className="shrink-0 border-warning/40 bg-warning/10 font-normal text-warning">
                    Paused
                  </Badge>
                ) : null}
              </div>
              {(pendingLeaveCount > 0 || pendingBranchCount > 0 || unassignedBranchCount > 0) && (
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {pendingLeaveCount > 0 ? (
                    <Badge variant="outline" className="shrink-0 border-warning/40 bg-warning/10 text-warning">
                      {pendingLeaveCount} leave pending
                    </Badge>
                  ) : null}
                  {pendingBranchCount > 0 ? (
                    <Badge variant="outline" className="shrink-0 border-warning/40 bg-warning/10 text-warning">
                      {pendingBranchCount} branches pending
                    </Badge>
                  ) : null}
                  {unassignedBranchCount > 0 ? (
                    <Badge variant="outline" className="shrink-0 border-warning/40 bg-warning/10 text-warning">
                      {unassignedBranchCount} without manager
                    </Badge>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-[55%] sm:justify-end">
            <Badge
              variant="outline"
              className="min-w-0 max-w-full shrink gap-1 overflow-hidden font-normal whitespace-normal"
            >
              <Mail className="size-3 shrink-0 opacity-70" />
              <span className="min-w-0 truncate">{stateHead.email}</span>
            </Badge>
            <Badge
              variant="outline"
              className="min-w-0 max-w-full shrink gap-1 overflow-hidden font-normal whitespace-normal"
            >
              <MapPin className="size-3 shrink-0 opacity-70" />
              <span className="min-w-0 truncate">
                {stateHead.state_name} ({stateHead.state_code})
              </span>
            </Badge>
            <Badge variant="secondary" className="shrink-0 gap-1 font-normal">
              <Crown className="size-3 shrink-0 opacity-80" />
              {MITRA_HIERARCHY_COPY.stateHead}
            </Badge>
            {canManage && onUpdated && onUnassigned ? (
              <DistributorHeadStateHeadActions
                stateHead={stateHead}
                onUpdated={onUpdated}
                onUnassigned={onUnassigned}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AdminMetricCardsGrid className="w-full min-w-0 max-w-full">
        <AdminMetricCard
          label="Total AUM"
          value={formatDistributorHeadInr(aumInr)}
          hint={`Sales MTD ${formatDistributorHeadInr(salesMtdInr)}`}
          icon={IndianRupee}
          tone="success"
          accent
        />
        <AdminMetricCard
          label={MITRA_HIERARCHY_COPY.branchManagers}
          value={`${formatDistributorHeadCount(activeManagerCount)} / ${formatDistributorHeadCount(branchCount)}`}
          icon={Users2}
          tone="info"
        />
        <AdminMetricCard
          label="Branches"
          value={formatDistributorHeadCount(branchCount)}
          hint={
            pendingBranchCount > 0 ? `${pendingBranchCount} awaiting approval` : undefined
          }
          icon={Building2}
          tone={pendingBranchCount > 0 ? "warning" : "muted"}
        />
        <AdminMetricCard
          label={MITRA_HIERARCHY_COPY.zyndMitras}
          value={formatDistributorHeadCount(partnerCount)}
          hint={`${activePartnerCount} active · ${formatDistributorHeadCount(clientCount)} clients`}
          icon={Network}
          tone="default"
        />
      </AdminMetricCardsGrid>
    </div>
  );
}
