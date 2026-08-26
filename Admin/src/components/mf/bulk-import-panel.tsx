"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  FileSpreadsheet,
  History,
  Info,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";

import { MfStatusChip, type MfStatusTone } from "@/components/mf/mf-status-chip";
import {
  AdminFormDialog,
  AdminInfoDialog,
} from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
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
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfBulkCatalogJobs,
  previewMfBulkCatalog,
  submitMfBulkCatalog,
  type MfBulkCatalogJob,
} from "@/lib/mf-admin-api";


const SAMPLE_CSV = `isin,action,category,position,reason
INF123456789,disable,,,Ops review
INF987654321,add_category,equity,10,Featured add`;

const CSV_COLUMNS = ["isin", "action", "category", "position", "reason"] as const;

const BULK_ACTIONS = [
  "disable",
  "enable",
  "force_hide",
  "force_show",
  "auto_visibility",
  "add_category",
  "set_order",
] as const;

function jobStatusTone(status: string): MfStatusTone {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "success" || normalized === "applied") {
    return "success";
  }
  if (normalized === "failed" || normalized === "rejected") return "danger";
  if (normalized === "pending" || normalized === "submitted" || normalized === "running") {
    return "warning";
  }
  return "neutral";
}

function countCsvRows(csv: string) {
  const lines = csv
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return Math.max(0, lines.length - 1);
}

function BulkImportInfoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AdminInfoDialog
      open={open}
      onClose={onClose}
      title="Bulk CSV reference"
      description="Required columns and supported row actions for catalog bulk import."
      icon={Info}
      iconTone="info"
      size="md"
    >
      <div className="space-y-5 text-compact">
        <div>
          <p className="font-medium text-foreground">CSV columns</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CSV_COLUMNS.map((column) => (
              <span
                key={column}
                className="rounded-control border border-border bg-muted/20 px-2 py-0.5 font-mono text-caption text-foreground"
              >
                {column}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="font-medium text-foreground">Supported actions</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BULK_ACTIONS.map((action) => (
              <span
                key={action}
                className="rounded-control bg-muted/40 px-2 py-0.5 font-mono text-caption text-foreground"
              >
                {action}
              </span>
            ))}
          </div>
        </div>
      </div>
    </AdminInfoDialog>
  );
}

function BulkCsvEditorDialog({
  open,
  csv,
  loading,
  canPublish,
  preview,
  onCsvChange,
  onPreview,
  onDryRun,
  onApply,
  onReset,
  onDismissPreview,
  onClose,
}: {
  open: boolean;
  csv: string;
  loading: boolean;
  canPublish: boolean;
  preview: Record<string, unknown> | null;
  onCsvChange: (value: string) => void;
  onPreview: () => void;
  onDryRun: () => void;
  onApply: () => void;
  onReset: () => void;
  onDismissPreview: () => void;
  onClose: () => void;
}) {
  return (
    <AdminFormDialog
      open={open}
      onClose={onClose}
      title="CSV payload"
      description="Paste rows with header line included."
      icon={FileSpreadsheet}
      iconTone="info"
      size="detail"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="outline" disabled={loading || !csv.trim()} onClick={onPreview}>
            <Search className="size-3.5" />
            Preview
          </Button>
          <Button
            variant="outline"
            disabled={loading || !canPublish || !csv.trim()}
            onClick={onDryRun}
          >
            <Play className="size-3.5" />
            Dry run
          </Button>
          <Button disabled={loading || !canPublish || !csv.trim()} onClick={onApply}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" disabled={loading} onClick={onReset}>
            <RotateCcw className="size-3.5" />
            Reset sample
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mf-bulk-csv-dialog">Bulk CSV</Label>
          <textarea
            id="mf-bulk-csv-dialog"
            className="min-h-field-2xl w-full rounded-control border border-input bg-transparent px-3 py-2 font-mono text-caption leading-relaxed"
            value={csv}
            onChange={(event) => onCsvChange(event.target.value)}
          />
        </div>
        {preview ? (
          <div className="rounded-control border border-border bg-muted/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-compact font-medium text-foreground">Preview results</p>
              <Button size="sm" variant="ghost" onClick={onDismissPreview}>
                Dismiss
              </Button>
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              {String(preview.matched_count)} matched · maker-checker{" "}
              {preview.requires_maker_checker ? "required" : "not required"}
            </p>
            <pre className="mt-3 max-h-scroll-sm overflow-auto rounded-control bg-muted/40 p-3 font-mono text-caption">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </AdminFormDialog>
  );
}

export function BulkImportPanel({ canPublish }: { canPublish: boolean }) {
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [jobs, setJobs] = useState<MfBulkCatalogJob[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [jobPage, setJobPage] = useState(0);
  const [jobPageSize, setJobPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const rowCount = useMemo(() => countCsvRows(csv), [csv]);
  const completedJobs = jobs.filter((job) => jobStatusTone(job.status) === "success").length;
  const jobPagination = useMemo(
    () => paginateItems(jobs, jobPage, jobPageSize),
    [jobPage, jobPageSize, jobs],
  );

  useEffect(() => {
    setJobPage(0);
  }, [jobPageSize, jobs.length]);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      setJobs(await fetchMfBulkCatalogJobs());
    } catch (err) {
      setError(getErrorMessage(err, "Could not load bulk jobs."));
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handlePreview = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await previewMfBulkCatalog(csv);
      setPreview(result);
      setMessage(`Matched ${result.matched_count} of ${result.row_count} rows.`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not preview CSV."));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (dryRun: boolean) => {
    if (!canPublish) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await submitMfBulkCatalog({ csv, dry_run: dryRun });
      setMessage(
        dryRun
          ? `Dry run complete — ${result.affected_count ?? 0} row(s).`
          : result.requires_maker_checker
            ? `Submitted for maker-checker approval (job ${result.job_id}).`
            : `Bulk job ${result.job_id} completed with status ${result.status}.`,
      );
      if (!dryRun) {
        setCsvDialogOpen(false);
        setPreview(null);
      }
      await loadJobs();
    } catch (err) {
      setError(getErrorMessage(err, "Could not submit bulk job."));
    } finally {
      setLoading(false);
    }
  };

  const closeCsvDialog = () => {
    if (loading) return;
    setCsvDialogOpen(false);
  };

  return (
    <div className="space-y-5">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

      <AdminMetricCardsGrid columns="three">
        <AdminMetricCard
          label="CSV rows"
          value={rowCount.toLocaleString()}
          icon={FileSpreadsheet}
          loading={false}
        />
        <AdminMetricCard
          label="Recent jobs"
          value={jobs.length.toLocaleString()}
          icon={History}
          loading={jobsLoading}
        />
        <AdminMetricCard
          label="Completed"
          value={completedJobs.toLocaleString()}
          icon={Upload}
          tone="success"
          loading={jobsLoading}
        />
      </AdminMetricCardsGrid>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setInfoDialogOpen(true)}
            aria-label="View bulk CSV reference"
          >
            <Info className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={jobsLoading}
            onClick={() => void loadJobs()}
            aria-label="Refresh bulk jobs"
          >
            <RefreshCw className={`size-3.5 ${jobsLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setCsvDialogOpen(true)}>
            <Plus className="size-3.5" />
            Import CSV
          </Button>
        </div>

        <AdminDataTable
          minWidth="lg"
          footer={
            <AdminTablePagination
              page={jobPagination.page}
              totalPages={jobPagination.totalPages}
              hasPrevious={jobPagination.hasPrevious}
              hasNext={jobPagination.hasNext}
              disabled={jobsLoading}
              totalCount={jobs.length}
              currentPageCount={jobPagination.items.length}
              pageSize={jobPageSize}
              onPageSizeChange={(next) => {
                setJobPageSize(next);
                setJobPage(0);
              }}
              onPrevious={() => setJobPage((page) => Math.max(0, page - 1))}
              onNext={() => setJobPage((page) => page + 1)}
            />
          }
        >
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Job</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
              <AdminTableHeadCell className="text-right">Rows</AdminTableHeadCell>
              <AdminTableHeadCell className="text-right">Affected</AdminTableHeadCell>
              <AdminTableHeadCell>Created</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {jobsLoading ? (
              <AdminTableSkeletonRows columns={5} />
            ) : jobPagination.items.length === 0 ? (
              <AdminTableStateRow colSpan={5}>
                No bulk jobs yet. Import a CSV to preview, dry-run, then apply.
              </AdminTableStateRow>
            ) : (
              jobPagination.items.map((job) => (
                <AdminTableRow key={job.job_id}>
                  <AdminTableCell>
                    <p className="font-medium text-foreground">{job.job_id}</p>
                    {job.admin_action_id ? (
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        Pending action: {job.admin_action_id}
                      </p>
                    ) : null}
                  </AdminTableCell>
                  <AdminTableCell>
                    <MfStatusChip
                      label={job.status}
                      tone={jobStatusTone(job.status)}
                      showIcon={false}
                    />
                  </AdminTableCell>
                  <AdminTableCell className="text-right">{job.row_count ?? "No data"}</AdminTableCell>
                  <AdminTableCell className="text-right">{job.affected_count ?? "No data"}</AdminTableCell>
                  <AdminTableCell className="text-muted-foreground">
                    {job.created_at ? new Date(job.created_at).toLocaleString() : "No data"}
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminDataTable>
      </div>

      <BulkImportInfoDialog open={infoDialogOpen} onClose={() => setInfoDialogOpen(false)} />
      <BulkCsvEditorDialog
        open={csvDialogOpen}
        csv={csv}
        loading={loading}
        canPublish={canPublish}
        preview={preview}
        onCsvChange={setCsv}
        onPreview={() => void handlePreview()}
        onDryRun={() => void handleSubmit(true)}
        onApply={() => void handleSubmit(false)}
        onReset={() => {
          setCsv(SAMPLE_CSV);
          setPreview(null);
        }}
        onDismissPreview={() => setPreview(null)}
        onClose={closeCsvDialog}
      />
    </div>
  );
}
