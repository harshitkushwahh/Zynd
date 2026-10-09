"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
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
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { getErrorMessage } from "@/lib/errors";
import {
  fetchNfoIngestionRuns,
  fetchNfoOffers,
  fetchNfoSchedulerStatus,
  patchNfoOffer,
  runNfoJob,
  type MfIngestionRun,
  type NfoOfferAdmin,
  type NfoSchedulerStatus,
} from "@/lib/mf-admin-api";

export default function NfoAdminPage() {
  const { hasPermission } = useAdminAuth();
  const canRun = hasPermission("mf.jobs.run");
  const canManage = hasPermission("mf.catalog.manage");

  const [status, setStatus] = useState<NfoSchedulerStatus | null>(null);
  const [offers, setOffers] = useState<NfoOfferAdmin[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [runs, setRuns] = useState<MfIngestionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [scheduler, offerPayload, ingestion] = await Promise.all([
        fetchNfoSchedulerStatus(),
        fetchNfoOffers(),
        fetchNfoIngestionRuns(40),
      ]);
      setStatus(scheduler);
      setOffers(offerPayload.items);
      setCounts(offerPayload.counts);
      setRuns(ingestion);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load NFO admin data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRun(jobName: string) {
    setBusy(jobName);
    setError("");
    setMessage("");
    try {
      await runNfoJob(jobName);
      setMessage(`Started ${jobName}.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, `Could not run ${jobName}.`));
    } finally {
      setBusy(null);
    }
  }

  async function toggleFeatured(offer: NfoOfferAdmin) {
    if (!canManage) return;
    setBusy(offer.product_id);
    try {
      await patchNfoOffer(offer.product_id, { is_featured: !offer.is_featured, admin_override: true });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update offer."));
    } finally {
      setBusy(null);
    }
  }

  const paged = paginateItems(offers, page, pageSize);

  return (
    <AdminSectionPageShell
      title="NFO"
      icon={Sparkles}
      breadcrumbSegments={[
        { label: "Mutual Funds", href: "/dashboard/mutual-funds" },
        { label: "NFO" },
      ]}
    >
      <div className="space-y-6">
        {error ? <AdminFeedbackMessage tone="danger">{error}</AdminFeedbackMessage> : null}
        {message ? <AdminFeedbackMessage tone="success">{message}</AdminFeedbackMessage> : null}

        <AdminMetricCardsGrid>
          <AdminMetricCard label="Open" value={String(counts.OPEN ?? 0)} />
          <AdminMetricCard label="Upcoming" value={String(counts.UPCOMING ?? 0)} />
          <AdminMetricCard label="Closed" value={String(counts.CLOSED ?? 0)} />
          <AdminMetricCard label="Featured" value={String(counts.featured ?? 0)} />
          <AdminMetricCard label="Stale OMS" value={String(counts.stale_oms ?? 0)} />
        </AdminMetricCardsGrid>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Scheduler</h2>
              <p className="text-caption text-muted-foreground">
                Runs after MF ingest succeeds. Fallback {status?.fallback_cron ?? "0 22 * * *"}{" "}
                {status?.timezone ?? "Asia/Kolkata"}.
              </p>
            </div>
            {canRun ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy != null}
                  onClick={() => handleRun("nfo-lifecycle-sync")}
                >
                  {busy === "nfo-lifecycle-sync" ? "Running…" : "Run lifecycle"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy != null}
                  onClick={() => handleRun("nfo-collection-assign-sync")}
                >
                  {busy === "nfo-collection-assign-sync" ? "Running…" : "Assign category"}
                </Button>
              </div>
            ) : null}
          </div>
          <dl className="grid gap-3 text-caption sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">MF boundary today</dt>
              <dd>{status?.mf_boundary_succeeded_today ? "Succeeded" : "Incomplete"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">NFO today</dt>
              <dd>
                {status?.nfo_succeeded_today
                  ? `Done (${status.last_trigger_kind ?? "—"})`
                  : "Not yet"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mutex</dt>
              <dd>
                {status?.mutex_busy
                  ? `Busy: ${(status.mutex_holders ?? []).join(", ") || "held"}`
                  : "Free"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Chain pending</dt>
              <dd>{status?.pending_after_mf ? "Queued after MF" : "No"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last MF run</dt>
              <dd className="truncate">{status?.last_mf_run_uuid ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last NFO success</dt>
              <dd>{status?.last_nfo_success_date ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Offers</h2>
          <AdminDataTable>
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHeadCell>Fund</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
                <AdminTableHeadCell>Window</AdminTableHeadCell>
                <AdminTableHeadCell>OMS</AdminTableHeadCell>
                <AdminTableHeadCell>Actions</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              {loading ? (
                <AdminTableStateRow colSpan={5}>Loading NFO offers…</AdminTableStateRow>
              ) : paged.items.length === 0 ? (
                <AdminTableStateRow colSpan={5}>No NFO offers yet.</AdminTableStateRow>
              ) : (
                paged.items.map((offer) => (
                  <AdminTableRow key={offer.id}>
                    <AdminTableCell>
                      <div className="font-medium">{offer.fund_name}</div>
                      <div className="text-caption text-muted-foreground">{offer.amc_name}</div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant={offer.status === "OPEN" ? "success" : "info"} showIcon={false}>
                        {offer.status}
                      </StatusBadge>
                    </AdminTableCell>
                    <AdminTableCell className="text-caption">
                      {offer.subscription_open_date ?? "—"} → {offer.subscription_close_date ?? "—"}
                    </AdminTableCell>
                    <AdminTableCell>{offer.purchase_allowed ? "Purchase on" : "Off"}</AdminTableCell>
                    <AdminTableCell>
                      {canManage ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === offer.product_id}
                          onClick={() => toggleFeatured(offer)}
                        >
                          {offer.is_featured ? "Unfeature" : "Feature"}
                        </Button>
                      ) : null}
                    </AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminDataTable>
          <AdminTablePagination
            page={paged.page}
            totalPages={paged.totalPages}
            hasPrevious={paged.hasPrevious}
            hasNext={paged.hasNext}
            onPrevious={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() => setPage((current) => current + 1)}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(0);
            }}
            totalCount={offers.length}
            currentPageCount={paged.items.length}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">NFO ingestion runs</h2>
          <AdminDataTable>
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHeadCell>Job</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
                <AdminTableHeadCell>Trigger</AdminTableHeadCell>
                <AdminTableHeadCell>Started</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              {runs.length === 0 ? (
                <AdminTableStateRow colSpan={4}>No NFO runs yet.</AdminTableStateRow>
              ) : (
                runs.map((run) => (
                  <AdminTableRow key={run.run_uuid ?? run.started_at}>
                    <AdminTableCell>{run.job_name}</AdminTableCell>
                    <AdminTableCell>{run.status}</AdminTableCell>
                    <AdminTableCell>{run.triggered_by}</AdminTableCell>
                    <AdminTableCell className="text-caption">{run.started_at}</AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminDataTable>
        </section>
      </div>
    </AdminSectionPageShell>
  );
}
