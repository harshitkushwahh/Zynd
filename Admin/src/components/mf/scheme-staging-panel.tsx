"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function statusTone(status: string) {
  if (status === "promoted" || status === "validated" || status === "approved") {
    return "border-success/30 bg-success/10 text-foreground";
  }
  if (status === "failed" || status === "rejected") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  return "border-border bg-muted/30 text-foreground";
}

export function SchemeStagingPanel({ canPublish }: { canPublish: boolean }) {
  const [batches, setBatches] = useState<MfStagingBatch[]>([]);
  const [selected, setSelected] = useState<MfStagingBatch | null>(null);
  const [rows, setRows] = useState<MfStagingRow[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  const loadRows = useCallback(async (batch: MfStagingBatch | null) => {
    if (!batch) {
      setRows([]);
      return;
    }
    try {
      const payload = await fetchMfStagingBatchRows(batch.batch_uuid, { page: 1 });
      setRows(payload.items);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load staging rows."));
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    void loadRows(selected);
  }, [selected, loadRows]);

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
      setMessage(`Promote finished: ${JSON.stringify(result.result ?? result)}`);
      await loadBatches();
    } catch (err) {
      setError(getErrorMessage(err, "Promote failed."));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      {error ? (
        <div className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-compact text-destructive">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-[var(--radius-card)] border border-success/30 bg-success/5 px-4 py-3 text-compact text-foreground">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Scheme staging batches</CardTitle>
          <CardDescription>
            Cybrilla ingest lands in Mongo first. Approve a validated batch, then promote to SQL as draft products.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-compact text-muted-foreground">Loading batches…</p> : null}
          {!loading && batches.length === 0 ? (
            <p className="text-compact text-muted-foreground">No staging batches yet. Run cybrilla-scheme-ingest.</p>
          ) : null}
          <div className="space-y-2">
            {batches.map((batch) => (
              <button
                key={batch.batch_uuid}
                type="button"
                onClick={() => setSelected(batch)}
                className={`flex w-full items-center justify-between rounded-[var(--radius-card)] border px-4 py-3 text-left ${selected?.batch_uuid === batch.batch_uuid ? "border-primary" : "border-border"}`}
              >
                <div>
                  <p className="font-medium text-foreground">{batch.batch_uuid.slice(0, 8)}…</p>
                  <p className="text-caption text-muted-foreground">
                    {batch.stats.normalized ?? 0} normalized · {batch.stats.excluded ?? 0} excluded ·{" "}
                    {batch.stats.invalid ?? 0} invalid
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-caption ${statusTone(batch.status)}`}>
                  {batch.status}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Batch actions</CardTitle>
            <CardDescription>
              Status: {selected.status}
              {selected.approved_by ? ` · approved by ${selected.approved_by}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!canPublish || actionLoading || selected.status !== "validated"}
              onClick={() => void handleApprove()}
            >
              Approve
            </Button>
            <Button
              disabled={!canPublish || actionLoading}
              onClick={() => void handlePromote()}
            >
              Promote to SQL
            </Button>
            <Input
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Rejection reason"
              className="max-w-xs"
            />
            <Button
              variant="destructive"
              disabled={!canPublish || actionLoading || !rejectReason.trim()}
              onClick={() => void handleReject()}
            >
              Reject
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Staged rows</CardTitle>
            <CardDescription>Showing up to 50 rows from the selected batch.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-compact">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2">ISIN</th>
                  <th className="px-2 py-2">Scheme</th>
                  <th className="px-2 py-2">Validation</th>
                  <th className="px-2 py-2">Promote</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.mongo_id ?? row.isin_growth} className="border-b border-border/60">
                    <td className="px-2 py-2">{row.isin_growth}</td>
                    <td className="px-2 py-2">{row.scheme_name ?? "—"}</td>
                    <td className="px-2 py-2">
                      {row.validation_status}
                      {row.validation_reason ? ` (${row.validation_reason})` : ""}
                    </td>
                    <td className="px-2 py-2">
                      {row.promote_status ?? "—"}
                      {row.promote_error ? ` · ${row.promote_error}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
