"use client";

import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { RiskProfileAssessmentDetailDialog } from "@/components/risk-profile/risk-profile-assessment-detail-dialog";
import { RiskProfileUserCell } from "@/components/risk-profile/risk-profile-user-cell";
import { RiskProfileUserReportsDialog } from "@/components/risk-profile/risk-profile-user-reports-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableRows,
  getOffsetPage,
} from "@/components/ui/admin-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { getErrorMessage } from "@/lib/errors";
import { downloadAdminRiskProfileReport } from "@/lib/risk-profile-pdf-download";
import { fetchUserRiskProfiles, type UserRiskProfileItem } from "@/lib/risk-profile-admin-api";

const TIERS = ["secure", "conservative", "moderate", "growth", "aggressive"];

function tierBadgeVariant(tier: string) {
  if (tier === "aggressive" || tier === "growth") return "warning" as const;
  if (tier === "secure" || tier === "conservative") return "info" as const;
  return "success" as const;
}

export function RiskProfileUsersPanel() {
  const [items, setItems] = useState<UserRiskProfileItem[]>([]);
  const [tier, setTier] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportsUser, setReportsUser] = useState<UserRiskProfileItem | null>(null);
  const [detailState, setDetailState] = useState<{ user: UserRiskProfileItem; assessmentId: string } | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchUserRiskProfiles({
        tier: tier === "all" ? undefined : tier,
        limit: ADMIN_TABLE_PAGE_SIZE,
        offset,
      });
      setItems(result.items);
      setHasMore(result.items.length === ADMIN_TABLE_PAGE_SIZE);
    } catch (err) {
      setItems([]);
      setHasMore(false);
      setError(getErrorMessage(err, "Could not load user risk profiles."));
    } finally {
      setLoading(false);
    }
  }, [tier, offset]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const handleTierChange = (value: string | null) => {
    setTier(value ?? "all");
    setOffset(0);
  };

  const openSingleReport = (item: UserRiskProfileItem) => {
    setDetailState({ user: item, assessmentId: item.assessment_id });
  };

  const handleDownloadReport = async (item: UserRiskProfileItem) => {
    await downloadAdminRiskProfileReport(item.user_id, item.assessment_id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminSectionTitle>User risk profile</AdminSectionTitle>
        <Select value={tier} onValueChange={handleTierChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            {TIERS.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <AdminDataTable minWidth="lg">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>User</AdminTableHeadCell>
            <AdminTableHeadCell>Reports</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Latest score</AdminTableHeadCell>
            <AdminTableHeadCell>Latest tier</AdminTableHeadCell>
            <AdminTableHeadCell>Last completed</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows
            colSpan={6}
            loading={loading}
            isEmpty={items.length === 0}
            emptyMessage="No completed risk profiles yet."
          >
            {items.map((item) => {
              const isGroup = item.assessment_count > 1;
              return (
                <AdminTableRow key={item.user_id}>
                  <AdminTableCell>
                    <RiskProfileUserCell user={item} />
                  </AdminTableCell>
                  <AdminTableCell>
                    <Badge variant={isGroup ? "secondary" : "outline"}>
                      {item.assessment_count} report{item.assessment_count === 1 ? "" : "s"}
                    </Badge>
                  </AdminTableCell>
                  <AdminTableCell className="text-right tabular-nums">{item.score}</AdminTableCell>
                  <AdminTableCell>
                    <StatusBadge variant={tierBadgeVariant(item.tier)} showIcon={false} className="normal-case capitalize">
                      {item.tier}
                    </StatusBadge>
                  </AdminTableCell>
                  <AdminTableCell className="text-muted-foreground">
                    {item.updated_at ? new Date(item.updated_at).toLocaleString() : "No data"}
                  </AdminTableCell>
                  <AdminTableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button size="icon-sm" variant="ghost" aria-label="Row actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        {isGroup ? (
                          <DropdownMenuItem onClick={() => setReportsUser(item)}>View reports</DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => openSingleReport(item)}>View report</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleDownloadReport(item)}>
                              Download report
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </AdminTableCell>
                </AdminTableRow>
              );
            })}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>

      <AdminTablePagination
        page={getOffsetPage(offset)}
        hasPrevious={offset > 0}
        hasNext={hasMore}
        disabled={loading}
        onPrevious={() => setOffset((value) => Math.max(0, value - ADMIN_TABLE_PAGE_SIZE))}
        onNext={() => setOffset((value) => value + ADMIN_TABLE_PAGE_SIZE)}
      />

      <RiskProfileUserReportsDialog
        open={Boolean(reportsUser)}
        user={reportsUser}
        onClose={() => setReportsUser(null)}
      />

      <RiskProfileAssessmentDetailDialog
        open={Boolean(detailState)}
        user={detailState?.user ?? null}
        userId={detailState?.user.user_id ?? null}
        assessmentId={detailState?.assessmentId ?? null}
        onClose={() => setDetailState(null)}
      />
    </div>
  );
}
