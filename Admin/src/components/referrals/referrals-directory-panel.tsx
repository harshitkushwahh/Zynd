"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { referralReferrerDetailHref } from "@/lib/admin-referrals-navigation";
import { userDashboardProfileHref } from "@/lib/admin-user-ref";
import {
  formatReferralInr,
  REFERRAL_STAGE_LABELS,
  type AdminReferralAttribution,
} from "@/lib/referrals-admin-api";
import { useAdminSearch } from "@/hooks/use-admin-search";
import { formatTimestampDetail } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const STAGE_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: "all", label: "All stages" },
  { value: "signed_up", label: "Signed up" },
  { value: "kyc_verified", label: "KYC verified" },
  { value: "first_investment", label: "First investment" },
  { value: "qualified", label: "Qualified" },
  { value: "engaged", label: "Engaged" },
  { value: "pending", label: "Pending qualification" },
];

function stageVariant(stage: AdminReferralAttribution["current_stage"]) {
  if (stage === "engaged" || stage === "qualified") return "success" as const;
  if (stage === "first_investment" || stage === "kyc_verified") return "info" as const;
  return "neutral" as const;
}

export function ReferralsDirectoryPanel() {
  const [stage, setStage] = useState("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const {
    items,
    loading,
    error,
    refetch,
    setError,
  } = useAdminSearch<AdminReferralAttribution>({
    scope: "referrals.attributions",
    query: search,
    stage,
    limit: ADMIN_TABLE_PAGE_SIZE,
    offset,
  });
  const hasMore = items.length === ADMIN_TABLE_PAGE_SIZE;

  useEffect(() => {
    setOffset(0);
  }, [search, stage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm"
          placeholder="Search referrer, referee, code..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setOffset(0);
              void refetch();
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AdminSelect
            value={stage}
            onValueChange={(value) => {
              setStage(value);
              setOffset(0);
            }}
            options={STAGE_FILTER_OPTIONS}
            placeholder="Stage"
            className="min-w-select-md"
            triggerClassName="w-auto"
          />
          <Button type="button" variant="outline" size="icon" onClick={() => void refetch()} aria-label="Refresh">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : null}

      <AdminDataTable
        minWidth="lg"
        footer={
          <AdminTablePagination
            page={getOffsetPage(offset)}
            hasPrevious={offset > 0}
            hasNext={hasMore}
            disabled={loading}
            currentPageCount={items.length}
            hasMore={hasMore}
            onPrevious={() => setOffset((current) => Math.max(0, current - ADMIN_TABLE_PAGE_SIZE))}
            onNext={() => setOffset((current) => current + ADMIN_TABLE_PAGE_SIZE)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Referrer</AdminTableHeadCell>
            <AdminTableHeadCell>Referee</AdminTableHeadCell>
            <AdminTableHeadCell>Stage</AdminTableHeadCell>
            <AdminTableHeadCell>Signed up</AdminTableHeadCell>
            <AdminTableHeadCell>Est. reward</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading && items.length === 0 ? (
            <AdminTableSkeletonRows columns={5} />
          ) : items.length === 0 ? (
            <AdminTableStateRow colSpan={5}>
              No referral attributions match your filters.
            </AdminTableStateRow>
          ) : (
            items.map((item) => (
              <AdminTableRow key={item.id}>
                <AdminTableCell>
                  {item.referrer ? (
                    <Link
                      href={referralReferrerDetailHref(item.referrer.client_id)}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.referrer.display_name}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {item.referrer ? (
                    <p className="text-caption text-muted-foreground">{item.referrer.email}</p>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell>
                  {item.referee ? (
                    <Link
                      href={userDashboardProfileHref(item.referee.client_id, "referrals")}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.referee.display_name}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {item.referee ? (
                    <p className="text-caption text-muted-foreground">{item.referee.email}</p>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={stageVariant(item.current_stage)}>
                    {REFERRAL_STAGE_LABELS[item.current_stage]}
                  </StatusBadge>
                  {item.pending_qualification ? (
                    <p className="mt-1 text-caption text-muted-foreground">Hold period active</p>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell>{formatTimestampDetail(item.signed_up_at)}</AdminTableCell>
                <AdminTableCell>{formatReferralInr(item.estimated_reward_inr)}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
