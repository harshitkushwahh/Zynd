"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DistributorPartnerReviewDialog } from "@/components/distributor-head/distributor-partner-review-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminTableSkeleton } from "@/components/ui/admin-skeletons";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
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
  paginateItems,
} from "@/components/ui/admin-table";
import {
  fetchPendingDistributorPartners,
  type AdminPendingDistributorPartner,
} from "@/lib/admin-distributor-partners-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";

const TABLE_COLUMN_COUNT = 5;

function matchesPartnerSearch(partner: AdminPendingDistributorPartner, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [partner.name, partner.email, partner.pan_masked ?? "", partner.phone ?? ""].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

export function DistributorPartnerQueuePanel() {
  const [items, setItems] = useState<AdminPendingDistributorPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchPendingDistributorPartners();
      setItems(result.items);
    } catch (err) {
      setItems([]);
      setError(getErrorMessage(err, "Could not load pending Zynd Mitra applications."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => items.filter((item) => matchesPartnerSearch(item, search)),
    [items, search],
  );

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const openReview = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setReviewOpen(true);
  };

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search by name, email, PAN, or phone"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        {!loading ? (
          filtered.length > 0 ? (
            <Badge className="w-fit shrink-0 tabular-nums">
              {filtered.length} application{filtered.length === 1 ? "" : "s"} awaiting review
            </Badge>
          ) : (
            <Badge variant="secondary" className="w-fit shrink-0 font-normal tabular-nums">
              0 applications awaiting review
            </Badge>
          )
        ) : null}
      </div>

      {loading ? (
        <AdminTableSkeleton columns={TABLE_COLUMN_COUNT} rows={6} minWidth="5xl" />
      ) : (
        <AdminDataTable
          minWidth="5xl"
          footer={
            <AdminTablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              hasPrevious={pagination.hasPrevious}
              hasNext={pagination.hasNext}
              totalCount={filtered.length}
              currentPageCount={pagination.items.length}
              pageSize={pageSize}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(0);
              }}
              onPrevious={() => setPage((current) => Math.max(0, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          }
        >
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Applicant</AdminTableHeadCell>
              <AdminTableHeadCell>Contact</AdminTableHeadCell>
              <AdminTableHeadCell>PAN</AdminTableHeadCell>
              <AdminTableHeadCell>Submitted</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {pagination.items.length === 0 ? (
              <AdminTableStateRow colSpan={TABLE_COLUMN_COUNT}>
                {items.length === 0
                  ? "No applications awaiting HO review."
                  : "No applications match your search."}
              </AdminTableStateRow>
            ) : (
              pagination.items.map((partner) => (
                <AdminTableRow key={partner.id} onClick={() => openReview(partner.id)}>
                  <AdminTableCell className="font-medium">{partner.name}</AdminTableCell>
                  <AdminTableCell>
                    <div className="space-y-0.5">
                      <p>{partner.email}</p>
                      {partner.phone ? (
                        <p className="text-caption text-muted-foreground">{partner.phone}</p>
                      ) : null}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="font-mono text-caption">
                    {partner.pan_masked ?? "—"}
                  </AdminTableCell>
                  <AdminTableCell className="text-caption text-muted-foreground">
                    {partner.created_at ? formatTimestampDetail(partner.created_at) : "—"}
                  </AdminTableCell>
                  <AdminTableCell>
                    <StatusBadge variant="warning">Pending HO review</StatusBadge>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminDataTable>
      )}

      <DistributorPartnerReviewDialog
        partnerId={selectedPartnerId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onResolved={() => void load()}
      />
    </div>
  );
}
