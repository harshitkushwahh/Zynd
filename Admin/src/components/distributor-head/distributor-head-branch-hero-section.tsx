"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  IndianRupee,
  MapPin,
  Network,
  UserRound,
  Users2,
} from "lucide-react";

import { DistributorHeadBranchActions } from "@/components/distributor-head/distributor-head-branch-actions";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import type { AdminHierarchyBranchDetail, AdminHierarchyBranchStatus } from "@/lib/admin-distributor-hierarchy-api";
import { distributorHeadManagerHref } from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadCount, formatDistributorHeadInr } from "@/lib/distributor-head-format";

function branchStatusVariant(status: AdminHierarchyBranchStatus): StatusBadgeVariant {
  if (status === "active") return "success";
  if (status === "pending_approval") return "warning";
  if (status === "rejected") return "destructive";
  return "neutral";
}

type DistributorHeadBranchHeroSectionProps = {
  branch: AdminHierarchyBranchDetail;
  activePartnerCount: number;
  clientCount: number;
  aumInr: number;
  salesMtdInr: number;
  breadcrumb?: ReactNode;
  canApprove?: boolean;
  canManage?: boolean;
  currentUserId?: string | null;
  onUpdated?: (next: AdminHierarchyBranchDetail) => void;
  onAssigned?: () => void;
};

export function DistributorHeadBranchHeroSection({
  branch,
  activePartnerCount,
  clientCount,
  aumInr,
  salesMtdInr,
  breadcrumb,
  canApprove = false,
  canManage = false,
  currentUserId,
  onUpdated,
  onAssigned,
}: DistributorHeadBranchHeroSectionProps) {
  const needsManager =
    branch.status === "active" && (!branch.manager_id || branch.manager_unavailable);
  const isPending = branch.status === "pending_approval";
  const isRejected = branch.status === "rejected";

  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}

      <Card className="w-full min-w-0 max-w-full overflow-hidden border border-border/80 ring-0">
        <CardContent className="flex w-full min-w-0 flex-col gap-3 p-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-14">
              <Building2 className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 max-w-full truncate font-heading text-xl font-semibold text-foreground">
                  {branch.name}
                </h2>
                <StatusBadge variant={branchStatusVariant(branch.status)}>
                  {branch.status_label}
                </StatusBadge>
              </div>
              {(isPending || needsManager || isRejected) && (
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {isPending ? (
                    <Badge variant="outline" className="shrink-0 border-warning/40 bg-warning/10 text-warning">
                      Awaiting approval
                    </Badge>
                  ) : null}
                  {needsManager ? (
                    <Badge variant="outline" className="shrink-0 border-warning/40 bg-warning/10 text-warning">
                      {branch.manager_unavailable ? "Manager unavailable" : "No manager assigned"}
                    </Badge>
                  ) : null}
                  {isRejected && branch.rejection_reason ? (
                    <Badge variant="outline" className="min-w-0 max-w-full shrink font-normal whitespace-normal">
                      {branch.rejection_reason}
                    </Badge>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-[55%] sm:justify-end">
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {branch.branch_code ?? branch.id.toUpperCase()}
            </Badge>
            {branch.city ? (
              <Badge variant="outline" className="gap-1 font-normal">
                <MapPin className="size-3 shrink-0 opacity-70" />
                {branch.city}
              </Badge>
            ) : null}
            <Badge variant="outline" className="gap-1 font-normal">
              <MapPin className="size-3 shrink-0 opacity-70" />
              {branch.state_name} ({branch.state_code})
            </Badge>
            {branch.manager_id && !branch.manager_unavailable ? (
              <Badge variant="secondary" className="gap-1 font-normal">
                <Users2 className="size-3 shrink-0 opacity-80" />
                <Link href={distributorHeadManagerHref(branch.manager_id)} className="hover:underline">
                  {branch.manager_name}
                </Link>
              </Badge>
            ) : branch.manager_id && branch.manager_unavailable ? (
              <Badge variant="outline" className="gap-1 font-normal text-muted-foreground line-through decoration-muted-foreground/50">
                <Users2 className="size-3 shrink-0 opacity-70" />
                {branch.manager_name ?? "Removed manager"}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                <Users2 className="size-3 shrink-0 opacity-70" />
                Unassigned
              </Badge>
            )}
            {onUpdated ? (
              <DistributorHeadBranchActions
                branch={branch}
                canApprove={canApprove}
                canManage={canManage}
                currentUserId={currentUserId}
                onUpdated={onUpdated}
                onAssigned={onAssigned}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AdminMetricCardsGrid className="w-full min-w-0 max-w-full">
        <AdminMetricCard
          label={MITRA_HIERARCHY_COPY.zyndMitras}
          value={`${formatDistributorHeadCount(activePartnerCount)} / ${formatDistributorHeadCount(branch.partner_count)}`}
          hint="Active / total"
          icon={Network}
          tone="info"
        />
        <AdminMetricCard
          label="Clients"
          value={formatDistributorHeadCount(clientCount)}
          icon={UserRound}
          tone="muted"
        />
        <AdminMetricCard
          label="Total AUM"
          value={formatDistributorHeadInr(aumInr)}
          hint={`Sales MTD ${formatDistributorHeadInr(salesMtdInr)}`}
          icon={IndianRupee}
          tone="success"
          accent
        />
        <AdminMetricCard
          label={MITRA_HIERARCHY_COPY.branchManager}
          value={branch.manager_id && !branch.manager_unavailable ? "1 / 1" : "0 / 1"}
          hint={
            branch.manager_unavailable
              ? "Previous manager is unavailable — assign a new one"
              : branch.manager_name ?? "Assign a manager to activate coverage"
          }
          icon={Users2}
          tone={branch.manager_id && !branch.manager_unavailable ? "info" : "warning"}
        />
      </AdminMetricCardsGrid>
    </div>
  );
}
