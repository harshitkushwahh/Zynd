"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, RefreshCw } from "lucide-react";

import { RiskProfileAssessmentDetailDialog } from "@/components/risk-profile/risk-profile-assessment-detail-dialog";
import { RiskProfileUserCell } from "@/components/risk-profile/risk-profile-user-cell";
import { RiskProfileUserReportsDialog } from "@/components/risk-profile/risk-profile-user-reports-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
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
import { StatusBadge } from "@/components/ui/status-badge";
import { getErrorMessage } from "@/lib/errors";
import { downloadAdminRiskProfileReport } from "@/lib/risk-profile-pdf-download";
import {
  riskProfileUsersQueryKey,
  useRiskProfileUsersQuery,
} from "@/hooks/use-risk-profile-queries";
import { type UserRiskProfileItem } from "@/lib/risk-profile-admin-api";
import { cn } from "@/lib/utils";

const ALL = "all";

const TIER_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All tiers" },
  { value: "secure", label: "Secure" },
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "growth", label: "Growth" },
  { value: "aggressive", label: "Aggressive" },
];

function tierBadgeVariant(tier: string) {
  if (tier === "aggressive" || tier === "growth") return "warning" as const;
  if (tier === "secure" || tier === "conservative") return "info" as const;
  return "success" as const;
}

export function RiskProfileUsersPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState(ALL);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [error, setError] = useState("");
  const [reportsUser, setReportsUser] = useState<UserRiskProfileItem | null>(null);
  const [detailState, setDetailState] = useState<{
    user: UserRiskProfileItem;
    assessmentId: string;
  } | null>(null);

  const queryParams = {
    tier: tier === ALL ? undefined : tier,
    limit: pageSize,
    offset,
  };
  const { data, isPending, isFetching, error: queryError } = useRiskProfileUsersQuery(queryParams);
  const items = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;
  const showSkeleton = isPending && !data && items.length === 0;
  const loadError = queryError
    ? getErrorMessage(queryError, "Could not load user risk profiles.")
    : "";

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.display_name, item.email, item.client_id, item.tier]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, search]);

  const openSingleReport = (item: UserRiskProfileItem) => {
    setDetailState({ user: item, assessmentId: item.assessment_id });
  };

  const handleDownloadReport = async (item: UserRiskProfileItem) => {
    await downloadAdminRiskProfileReport(item.user_id, item.assessment_id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search by name, email, or ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <AdminSelect
            value={tier}
            onValueChange={(value) => {
              setTier(value);
              setOffset(0);
            }}
            options={TIER_FILTER_OPTIONS}
            placeholder="Tier"
            className="min-w-select-sm"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: riskProfileUsersQueryKey(queryParams) })
            }
            aria-label="Refresh"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error || loadError ? (
        <AdminFeedbackMessage variant="destructive">{error || loadError}</AdminFeedbackMessage>
      ) : null}

      <AdminDataTable
        minWidth="lg"
        footer={
          <AdminTablePagination
            page={getOffsetPage(offset, pageSize)}
            hasPrevious={offset > 0}
            hasNext={hasMore}
            disabled={isFetching}
            currentPageCount={filteredItems.length}
            hasMore={hasMore}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setOffset(0);
            }}
            onPrevious={() => setOffset((value) => Math.max(0, value - pageSize))}
            onNext={() => setOffset((value) => value + pageSize)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
            <AdminTableHeadCell>User</AdminTableHeadCell>
            <AdminTableHeadCell>Reports</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Latest score</AdminTableHeadCell>
            <AdminTableHeadCell>Latest tier</AdminTableHeadCell>
            <AdminTableHeadCell>Last completed</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={6} />
          ) : filteredItems.length === 0 ? (
            <AdminTableStateRow colSpan={6}>
              {items.length === 0
                ? "No completed risk profiles yet."
                : "No users match your search."}
            </AdminTableStateRow>
          ) : (
            filteredItems.map((item) => {
              const isGroup = item.assessment_count > 1;
              return (
                <AdminTableRow key={item.user_id}>
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
                          <DropdownMenuItem onClick={() => setReportsUser(item)}>
                            View reports
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => openSingleReport(item)}>
                              View report
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleDownloadReport(item)}>
                              Download report
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </AdminTableCell>
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
                    <StatusBadge
                      variant={tierBadgeVariant(item.tier)}
                      showIcon={false}
                      className="normal-case capitalize"
                    >
                      {item.tier}
                    </StatusBadge>
                  </AdminTableCell>
                  <AdminTableCell className="text-muted-foreground">
                    {item.updated_at ? new Date(item.updated_at).toLocaleString() : "No data"}
                  </AdminTableCell>
                </AdminTableRow>
              );
            })
          )}
        </AdminTableBody>
      </AdminDataTable>

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
