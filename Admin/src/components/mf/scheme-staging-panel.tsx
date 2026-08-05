"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Layers,
  MinusCircle,
  RefreshCw,
  Upload,
} from "lucide-react";

import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { MfStatusChip, type MfStatusTone } from "@/components/mf/mf-status-chip";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import type { AdminDialogSize } from "@/components/ui/admin-dialog";
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
} from "@/components/ui/admin-table";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  approveMfStagingBatch,
  fetchMfStagingBatchRows,
  fetchMfStagingBatches,
  promoteMfStagingBatch,
  rejectMfStagingBatch,
  type MfStagingBatch,
  type MfStagingRow,
} from "@/lib/mf-admin-api";
import { cn } from "@/lib/utils";

const ALL = "all";

const VALIDATION_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All validation" },
  { value: "valid", label: "Valid" },
  { value: "excluded", label: "Excluded" },
  { value: "invalid", label: "Invalid" },
];

const PROMOTE_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All promote" },
  { value: "pending", label: "Pending" },
  { value: "promoted", label: "Promoted" },
  { value: "failed", label: "Failed" },
];

function batchStatusTone(status: string): MfStatusTone {
  if (status === "promoted" || status === "validated" || status === "approved") return "success";
  if (status === "failed" || status === "rejected") return "danger";
  return "warning";
}

function validationTone(status: string | null | undefined): MfStatusTone {
  if (status === "valid") return "success";
  if (status === "excluded") return "warning";
  if (status === "invalid") return "danger";
  return "neutral";
}

function promoteTone(status: string | null | undefined): MfStatusTone {
  if (status === "promoted") return "success";
  if (status === "failed") return "danger";
  if (status === "pending") return "warning";
  return "neutral";
}

function StagingBatchStatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: "default" | "success" | "warning" | "danger" | "info" | "muted";
}) {
  const iconClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : tone === "info"
            ? "bg-primary/10 text-primary"
            : "bg-muted/50 text-muted-foreground";

  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : tone === "info"
            ? "text-primary"
            : "text-foreground";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", iconClass)}>
        <Icon className="size-3.5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-caption text-muted-foreground">{label}</p>
        <p className={cn("mt-0.5 font-heading text-h4 font-semibold tabular-nums", valueClass)}>{value}</p>
      </div>
    </div>
  );
}

function StagingBatchStatsBar({
  normalized,
  excluded,
  invalid,
}: {
  normalized: number;
  excluded: number;
  invalid: number;
}) {
  const total = normalized + excluded + invalid;
  if (total <= 0) {
    return (
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div className="h-full w-full bg-muted/60" />
      </div>
    );
  }

  const segments = [
    { key: "normalized", value: normalized, className: "bg-success" },
    { key: "excluded", value: excluded, className: "bg-warning" },
    { key: "invalid", value: invalid, className: "bg-destructive" },
  ].filter((segment) => segment.value > 0);

  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted/40">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={cn("h-full transition-[width]", segment.className)}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.key}: ${segment.value.toLocaleString()}`}
          />
        ))}
      </div>
      <p className="text-caption text-muted-foreground">
        {total.toLocaleString()} classified rows
        {normalized > 0 ? ` · ${Math.round((normalized / total) * 100)}% normalized` : ""}
      </p>
    </div>
  );
}

function StagingDialog({
  open,
  title,
  description,
  onClose,
  children,
  size = "detail",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: AdminDialogSize;
}) {
  return (
    <AdminDetailDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={Layers}
      iconTone="info"
      size={size}
    >
      {children}
    </AdminDetailDialog>
  );
}

export function SchemeStagingPanel({ canPublish }: { canPublish: boolean }) {
  const [batches, setBatches] = useState<MfStagingBatch[]>([]);
  const [selected, setSelected] = useState<MfStagingBatch | null>(null);
  const [rows, setRows] = useState<MfStagingRow[]>([]);
  const [rowPage, setRowPage] = useState(1);
  const [rowPageSize, setRowPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [rowTotal, setRowTotal] = useState(0);
  const [rowHasMore, setRowHasMore] = useState(false);
  const [validationFilter, setValidationFilter] = useState("");
  const [promoteFilter, setPromoteFilter] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [batchesDialogOpen, setBatchesDialogOpen] = useState(false);
  const [actionsDialogOpen, setActionsDialogOpen] = useState(false);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMfStagingBatches(30);
      setBatches(data);
      setSelected((current) => {
        if (!current) return data[0] ?? null;
        return data.find((batch) => batch.batch_uuid === current.batch_uuid) ?? data[0] ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err, "Could not load staging batches."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRows = useCallback(async () => {
    if (!selected) {
      setRows([]);
      setRowTotal(0);
      setRowHasMore(false);
      return;
    }

    setRowsLoading(true);
    setError("");
    try {
      const payload = await fetchMfStagingBatchRows(selected.batch_uuid, {
        page: rowPage,
        page_size: rowPageSize,
        validation_status: validationFilter || undefined,
        promote_status: promoteFilter || undefined,
      });
      setRows(payload.items);
      setRowTotal(payload.total);
      setRowHasMore(payload.has_more);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load staging rows."));
    } finally {
      setRowsLoading(false);
    }
  }, [promoteFilter, rowPage, rowPageSize, selected, validationFilter]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setRowPage(1);
  }, [selected?.batch_uuid, validationFilter, promoteFilter, rowPageSize]);

  const rowTotalPages = Math.max(1, Math.ceil(rowTotal / rowPageSize));

  async function handleApprove() {
    if (!selected || !canPublish) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await approveMfStagingBatch(selected.batch_uuid);
      setMessage("Batch approved for promote.");
      await loadBatches();
    } catch (err) {
      setError(getErrorMessage(err, "Approve failed."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selected || !canPublish || !rejectReason.trim()) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await rejectMfStagingBatch(selected.batch_uuid, rejectReason.trim());
      setRejectReason("");
      setMessage("Batch rejected.");
      await loadBatches();
    } catch (err) {
      setError(getErrorMessage(err, "Reject failed."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePromote() {
    if (!selected || !canPublish) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const result = await promoteMfStagingBatch(selected.batch_uuid);
      const summary = result.result ?? result;
      setMessage(
        typeof summary === "object" && summary !== null
          ? `Promote finished: ${Object.entries(summary as Record<string, unknown>)
              .map(([key, value]) => `${key} ${value}`)
              .join(" · ")}`
          : "Promote finished.",
      );
      await loadBatches();
      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err, "Promote failed."));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <div
        className={cn(
          "w-full rounded-[var(--radius-card)] border bg-card",
          selected ? "border-border" : "border-dashed border-border/80",
        )}
      >
        <div className="flex w-full flex-col gap-4 p-4">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {selected ? (
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Database className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
                    Selected batch
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className="font-heading text-h4 font-semibold text-foreground"
                      title={selected.batch_uuid}
                    >
                      {selected.batch_uuid.slice(0, 8)}…
                    </h3>
                    <MfStatusChip
                      label={selected.status}
                      tone={batchStatusTone(selected.status)}
                      showIcon={false}
                    />
                  </div>
                  <p className="text-caption text-muted-foreground">
                    {selected.created_at
                      ? `Ingested ${new Date(selected.created_at).toLocaleString()}`
                      : "Ingest time unavailable"}
                    {(selected.stats.raw_rows ?? 0) > 0
                      ? ` · ${(selected.stats.raw_rows ?? 0).toLocaleString()} raw rows`
                      : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                  <Database className="size-5" strokeWidth={2} />
                </div>
                <div>
                  <p className="font-medium text-foreground">No batch selected</p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    Choose a staging batch to review rows and run promote actions.
                  </p>
                </div>
              </div>
            )}

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setBatchesDialogOpen(true)}>
                Choose batch
              </Button>
              <Button disabled={!selected} onClick={() => setActionsDialogOpen(true)}>
                Batch actions
              </Button>
            </div>
          </div>

          {selected ? (
            <div className="w-full space-y-4 border-t border-border pt-4">
              <StagingBatchStatsBar
                normalized={selected.stats.normalized ?? 0}
                excluded={selected.stats.excluded ?? 0}
                invalid={selected.stats.invalid ?? 0}
              />
              <div className="grid w-full grid-cols-2 gap-x-6 gap-y-4 xl:grid-cols-4">
                <StagingBatchStatTile
                  label="Normalized"
                  value={(selected.stats.normalized ?? 0).toLocaleString()}
                  icon={CheckCircle2}
                  tone="success"
                />
                <StagingBatchStatTile
                  label="Excluded"
                  value={(selected.stats.excluded ?? 0).toLocaleString()}
                  icon={MinusCircle}
                  tone="warning"
                />
                <StagingBatchStatTile
                  label="Invalid"
                  value={(selected.stats.invalid ?? 0).toLocaleString()}
                  icon={AlertCircle}
                  tone="danger"
                />
                <StagingBatchStatTile
                  label="Promoted"
                  value={(selected.stats.promoted ?? 0).toLocaleString()}
                  icon={Upload}
                  tone="info"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <StagingDialog
        open={batchesDialogOpen}
        title="Staging batches"
        description="Select a Cybrilla ingest batch to review and promote."
        onClose={() => setBatchesDialogOpen(false)}
        size="wide"
      >
        <div className="mb-3 flex justify-end">
          <Button
            variant="outline"
            size="icon"
            disabled={loading}
            onClick={() => void loadBatches()}
            aria-label="Refresh staging batches"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <AdminDataTable minWidth="md">
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Batch</AdminTableHeadCell>
              <AdminTableHeadCell>Stats</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeletonRows columns={3} />
            ) : batches.length === 0 ? (
              <AdminTableStateRow colSpan={3}>
                No staging batches yet. Run cybrilla-scheme-ingest.
              </AdminTableStateRow>
            ) : (
              batches.map((batch) => {
                const isSelected = selected?.batch_uuid === batch.batch_uuid;
                return (
                  <AdminTableRow
                    key={batch.batch_uuid}
                    className={cn(isSelected && "bg-muted/40")}
                    onClick={() => {
                      setSelected(batch);
                      setBatchesDialogOpen(false);
                    }}
                  >
                    <AdminTableCell>
                      <p className="font-medium text-foreground">{batch.batch_uuid.slice(0, 8)}…</p>
                      {batch.created_at ? (
                        <p className="mt-0.5 text-caption text-muted-foreground">
                          {new Date(batch.created_at).toLocaleString()}
                        </p>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell className="text-muted-foreground">
                      {(batch.stats.normalized ?? 0).toLocaleString()} normalized ·{" "}
                      {(batch.stats.excluded ?? 0).toLocaleString()} excluded ·{" "}
                      {(batch.stats.invalid ?? 0).toLocaleString()} invalid
                    </AdminTableCell>
                    <AdminTableCell>
                      <MfStatusChip
                        label={batch.status}
                        tone={batchStatusTone(batch.status)}
                        showIcon={false}
                      />
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminDataTable>
      </StagingDialog>

      <StagingDialog
        open={actionsDialogOpen}
        title="Batch actions"
        description={
          selected
            ? `Status: ${selected.status}${selected.approved_by ? ` · approved by ${selected.approved_by}` : ""}`
            : undefined
        }
        onClose={() => setActionsDialogOpen(false)}
        size="md"
      >
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            disabled={!canPublish || actionLoading || selected?.status !== "validated"}
            onClick={() => void handleApprove()}
          >
            Approve
          </Button>
          <Button disabled={!canPublish || actionLoading || !selected} onClick={() => void handlePromote()}>
            Promote to SQL
          </Button>
          <Input
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Rejection reason"
          />
          <Button
            variant="destructive"
            disabled={!canPublish || actionLoading || !rejectReason.trim() || !selected}
            onClick={() => void handleReject()}
          >
            Reject
          </Button>
        </div>
      </StagingDialog>

      {selected ? (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <AdminSelect
                  value={validationFilter || ALL}
                  onValueChange={(value) => setValidationFilter(value === ALL ? "" : value)}
                  options={VALIDATION_FILTER_OPTIONS}
                  placeholder="Validation"
                  className="min-w-select-sm"
                />
                <AdminSelect
                  value={promoteFilter || ALL}
                  onValueChange={(value) => setPromoteFilter(value === ALL ? "" : value)}
                  options={PROMOTE_FILTER_OPTIONS}
                  placeholder="Promote"
                  className="min-w-select-sm"
                />
              </div>
            </div>

            <AdminDataTable
              minWidth="xl"
              footer={
                <AdminTablePagination
                  page={rowPage - 1}
                  totalPages={rowTotalPages}
                  hasPrevious={rowPage > 1}
                  hasNext={rowHasMore}
                  disabled={rowsLoading}
                  totalCount={rowTotal}
                  currentPageCount={rows.length}
                  pageSize={rowPageSize}
                  onPageSizeChange={(next) => {
                    setRowPageSize(next);
                    setRowPage(1);
                  }}
                  onPrevious={() => setRowPage((page) => Math.max(1, page - 1))}
                  onNext={() => setRowPage((page) => page + 1)}
                />
              }
            >
              <AdminTableHeader>
                <tr>
                  <AdminTableHeadCell>ISIN</AdminTableHeadCell>
                  <AdminTableHeadCell>Scheme</AdminTableHeadCell>
                  <AdminTableHeadCell>Validation</AdminTableHeadCell>
                  <AdminTableHeadCell>Promote</AdminTableHeadCell>
                </tr>
              </AdminTableHeader>
              <AdminTableBody>
                {rowsLoading ? (
                  <AdminTableSkeletonRows columns={4} />
                ) : rows.length === 0 ? (
                  <AdminTableStateRow colSpan={4}>No rows match your filters.</AdminTableStateRow>
                ) : (
                  rows.map((row) => (
                    <AdminTableRow key={row.mongo_id ?? row.isin_growth ?? `${row.isin_growth}-row`}>
                      <AdminTableCell className="font-mono text-caption text-foreground">
                        {row.isin_growth ?? "—"}
                      </AdminTableCell>
                      <AdminTableCell>
                        <p className="font-medium text-foreground">{row.scheme_name ?? "—"}</p>
                        {row.amc_name ? (
                          <p className="mt-0.5 text-caption text-muted-foreground">{row.amc_name}</p>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell>
                        <MfStatusChip
                          label={
                            row.validation_reason
                              ? `${row.validation_status ?? "—"} (${row.validation_reason})`
                              : (row.validation_status ?? "—")
                          }
                          tone={validationTone(row.validation_status)}
                          showIcon={false}
                        />
                      </AdminTableCell>
                      <AdminTableCell>
                        <MfStatusChip
                          label={
                            row.promote_error
                              ? `${row.promote_status ?? "—"} · ${row.promote_error}`
                              : (row.promote_status ?? "—")
                          }
                          tone={promoteTone(row.promote_status)}
                          showIcon={false}
                        />
                      </AdminTableCell>
                    </AdminTableRow>
                  ))
                )}
              </AdminTableBody>
            </AdminDataTable>
        </div>
      ) : null}
    </section>
  );
}
