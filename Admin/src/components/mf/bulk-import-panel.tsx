"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfBulkCatalogJobs,
  previewMfBulkCatalog,
  submitMfBulkCatalog,
  type MfBulkCatalogJob,
} from "@/lib/mf-admin-api";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

const SAMPLE_CSV = `isin,action,category,position,reason
INF123456789,disable,,,Ops review
INF987654321,add_category,equity,10,Featured add`;

export function BulkImportPanel({ canPublish }: { canPublish: boolean }) {
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [jobs, setJobs] = useState<MfBulkCatalogJob[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await fetchMfBulkCatalogJobs());
    } catch (err) {
      setError(getErrorMessage(err, "Could not load bulk jobs."));
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
      await loadJobs();
    } catch (err) {
      setError(getErrorMessage(err, "Could not submit bulk job."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? <p className="text-compact text-destructive">{error}</p> : null}
      {message ? <p className="text-compact text-success">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Bulk catalog import</CardTitle>
          <CardDescription>
            CSV columns: isin, action, category, position, reason. Actions: disable, enable,
            force_hide, force_show, auto_visibility, add_category, set_order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="min-h-[180px] w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 font-mono text-caption"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={loading} onClick={() => void handlePreview()}>
              Preview
            </Button>
            <Button variant="outline" disabled={loading || !canPublish} onClick={() => void handleSubmit(true)}>
              Dry run
            </Button>
            <Button disabled={loading || !canPublish} onClick={() => void handleSubmit(false)}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {String(preview.matched_count)} matched · maker-checker{" "}
              {preview.requires_maker_checker ? "required" : "not required"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-64 overflow-auto rounded-[var(--radius-control)] bg-muted p-3 text-caption">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent bulk jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-compact text-muted-foreground">No bulk jobs yet.</p>
          ) : (
            jobs.map((job) => (
              <div key={job.job_id} className="rounded-[var(--radius-card)] border border-border p-3 text-compact">
                <p className="font-medium">{job.job_id}</p>
                <p className="text-muted-foreground">
                  {job.status} · {job.row_count ?? 0} rows · {job.affected_count ?? 0} affected
                </p>
                {job.admin_action_id ? (
                  <p className="text-caption text-muted-foreground">Pending action: {job.admin_action_id}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
