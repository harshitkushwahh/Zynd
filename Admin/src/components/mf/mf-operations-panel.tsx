"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  AlertTriangle,
  Clock3,
  Play,
  RefreshCw,
  Settings2,
} from "lucide-react";

import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { MfStatusChip, type MfStatusTone } from "@/components/mf/mf-status-chip";
import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfIngestionRuns,
  fetchMfJobs,
  runMfJob,
  type MfIngestionRun,
  type MfJob,
} from "@/lib/mf-admin-api";

const ALL_PHASES = "all";
const ALL_STATUSES = "all";


function runStatusTone(status: string | null | undefined): MfStatusTone {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "succeeded" || normalized === "success") return "success";
  if (normalized === "partial") return "warning";
  if (normalized === "failed") return "danger";
  if (normalized === "running") return "warning";
  return "neutral";
}

function formatCount(value: number | null | undefined) {
  if (value == null) return "No data";
  return value.toLocaleString();
}

export function MfOperationsPanel({ canRunJobs }: { canRunJobs: boolean }) {
  const [jobs, setJobs] = useState<MfJob[]>([]);
  const [runs, setRuns] = useState<MfIngestionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState(ALL_PHASES);
  const [runStatusFilter, setRunStatusFilter] = useState(ALL_STATUSES);
  const [jobPage, setJobPage] = useState(0);
  const [runPage, setRunPage] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [jobsResult, runsResult] = await Promise.all([
        fetchMfJobs(),
        fetchMfIngestionRuns(30),
      ]);
      setJobs(jobsResult);
      setRuns(runsResult);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load operations data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const phases = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.phase))).sort((a, b) => a - b),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();
    return jobs.filter((job) => {
      if (phaseFilter !== ALL_PHASES && String(job.phase) !== phaseFilter) return false;
      if (!query) return true;
      return (
        job.name.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query) ||
        job.cron.toLowerCase().includes(query)
      );
    });
  }, [jobSearch, jobs, phaseFilter]);

  const jobPagination = useMemo(
    () => paginateItems(filteredJobs, jobPage, ADMIN_TABLE_PAGE_SIZE),
    [filteredJobs, jobPage],
  );

  const runStatuses = useMemo(
    () =>
      Array.from(
        new Set(
          runs
            .map((run) => (run.status ?? "").trim())
            .filter(Boolean),
        ),
      ).sort(),
    [runs],
  );

  const filteredRuns = useMemo(() => {
    if (runStatusFilter === ALL_STATUSES) return runs;
    return runs.filter((run) => (run.status ?? "").toLowerCase() === runStatusFilter.toLowerCase());
  }, [runStatusFilter, runs]);

  const runPagination = useMemo(
    () => paginateItems(filteredRuns, runPage, ADMIN_TABLE_PAGE_SIZE),
    [filteredRuns, runPage],
  );

  useEffect(() => {
    setJobPage(0);
  }, [jobSearch, phaseFilter]);

  useEffect(() => {
    setRunPage(0);
  }, [runStatusFilter]);

  const succeededJobs = jobs.filter(
    (job) => (job.last_run?.status ?? "").toLowerCase() === "succeeded",
  ).length;
  const attentionJobs = jobs.filter((job) => {
    const status = (job.last_run?.status ?? "").toLowerCase();
    return status === "failed" || status === "partial";
  }).length;

  const handleRunJob = async (jobName: string) => {
    if (!canRunJobs) return;
    setActionLoading(jobName);
    setMessage("");
    setError("");
    try {
      const result = await runMfJob(jobName);
      setMessage(`Job ${result.job} triggered.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not run job."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <AdminSectionTitle icon={Settings2}>Operations</AdminSectionTitle>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void loadData()}>
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Scheduler jobs"
          value={jobs.length.toLocaleString()}
          icon={Settings2}
          loading={loading}
        />
        <AdminMetricCard
          label="Last run OK"
          value={succeededJobs.toLocaleString()}
          icon={Play}
          tone="success"
          loading={loading}
        />
        <AdminMetricCard
          label="Needs attention"
          value={attentionJobs.toLocaleString()}
          icon={AlertTriangle}
          tone={attentionJobs > 0 ? "warning" : "muted"}
          loading={loading}
        />
        <AdminMetricCard
          label="Recent runs"
          value={runs.length.toLocaleString()}
          icon={Clock3}
          loading={loading}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminSectionTitle icon={Settings2} variant="section">
            Scheduler jobs
          </AdminSectionTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              value={phaseFilter}
              onValueChange={(value) => setPhaseFilter(value ?? ALL_PHASES)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All phases">
                  {phaseFilter === ALL_PHASES ? "All phases" : `Phase ${phaseFilter}`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PHASES}>All phases</SelectItem>
                {phases.map((phase) => (
                  <SelectItem key={phase} value={String(phase)}>
                    Phase {phase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AdminSearchInput
              containerClassName="max-w-sm sm:w-56"
              placeholder="Search jobs"
              value={jobSearch}
              onChange={(event) => setJobSearch(event.target.value)}
            />
          </div>
        </div>

        <AdminDataTable minWidth="4xl">
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Job</AdminTableHeadCell>
              <AdminTableHeadCell>Phase</AdminTableHeadCell>
              <AdminTableHeadCell>Schedule</AdminTableHeadCell>
              <AdminTableHeadCell>Last run</AdminTableHeadCell>
              <AdminTableHeadCell className="text-right">Processed</AdminTableHeadCell>
              {canRunJobs ? <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell> : null}
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeletonRows columns={canRunJobs ? 6 : 5} />
            ) : jobPagination.items.length === 0 ? (
              <AdminTableStateRow colSpan={canRunJobs ? 6 : 5}>No jobs match your filters.</AdminTableStateRow>
            ) : (
              jobPagination.items.map((job) => (
                <AdminTableRow key={job.name}>
                  <AdminTableCell>
                    <p className="max-w-md font-medium text-foreground">{job.description}</p>
                    <p className="mt-0.5 font-mono text-caption text-muted-foreground">{job.name}</p>
                  </AdminTableCell>
                  <AdminTableCell>
                    <span className="rounded-[var(--radius-control)] bg-muted/50 px-2 py-0.5 text-caption text-foreground">
                      Phase {job.phase}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell>
                    <code className="rounded-[var(--radius-control)] bg-muted/40 px-2 py-0.5 font-mono text-caption text-foreground">
                      {job.cron}
                    </code>
                  </AdminTableCell>
                  <AdminTableCell>
                    {job.last_run ? (
                      <div className="space-y-1">
                        <MfStatusChip
                          label={job.last_run.status ?? "unknown"}
                          tone={runStatusTone(job.last_run.status)}
                          showIcon={false}
                        />
                        <p className="text-caption text-muted-foreground">
                          {job.last_run.finished_at
                            ? new Date(job.last_run.finished_at).toLocaleString()
                            : "No finish time"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-caption text-muted-foreground">No runs yet</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="text-right tabular-nums">
                    {formatCount(job.last_run?.records_processed)}
                  </AdminTableCell>
                  {canRunJobs ? (
                    <AdminTableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === job.name}
                        onClick={() => void handleRunJob(job.name)}
                      >
                        {actionLoading === job.name ? "Running…" : "Run now"}
                      </Button>
                    </AdminTableCell>
                  ) : null}
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminDataTable>

        {!loading && filteredJobs.length > 0 ? (
          <AdminTablePagination
            page={jobPagination.page}
            totalPages={jobPagination.totalPages}
            hasPrevious={jobPagination.hasPrevious}
            hasNext={jobPagination.hasNext}
            disabled={loading}
            onPrevious={() => setJobPage((page) => Math.max(0, page - 1))}
            onNext={() => setJobPage((page) => page + 1)}
          />
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <AdminSectionTitle icon={Clock3} variant="section">
            Recent ingestion runs
          </AdminSectionTitle>
          <Select
            value={runStatusFilter}
            onValueChange={(value) => setRunStatusFilter(value ?? ALL_STATUSES)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses">
                {runStatusFilter === ALL_STATUSES ? "All statuses" : runStatusFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
              {runStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AdminDataTable minWidth="lg">
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Job</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
              <AdminTableHeadCell>Started</AdminTableHeadCell>
              <AdminTableHeadCell>Finished</AdminTableHeadCell>
              <AdminTableHeadCell className="text-right">Processed</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeletonRows columns={5} />
            ) : runPagination.items.length === 0 ? (
              <AdminTableStateRow colSpan={5}>No recent runs for this filter.</AdminTableStateRow>
            ) : (
              runPagination.items.map((run) => (
                <AdminTableRow key={run.run_uuid ?? `${run.job_name}-${run.started_at}`}>
                  <AdminTableCell className="font-medium text-foreground">
                    {run.job_name ?? "No data"}
                  </AdminTableCell>
                  <AdminTableCell>
                    <MfStatusChip
                      label={run.status ?? "unknown"}
                      tone={runStatusTone(run.status)}
                      showIcon={false}
                    />
                  </AdminTableCell>
                  <AdminTableCell className="text-muted-foreground">
                    {run.started_at ? new Date(run.started_at).toLocaleString() : "No data"}
                  </AdminTableCell>
                  <AdminTableCell className="text-muted-foreground">
                    {run.finished_at ? new Date(run.finished_at).toLocaleString() : "No data"}
                  </AdminTableCell>
                  <AdminTableCell className="text-right tabular-nums">
                    {formatCount(run.records_processed)}
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminDataTable>

        {!loading && filteredRuns.length > 0 ? (
          <AdminTablePagination
            page={runPagination.page}
            totalPages={runPagination.totalPages}
            hasPrevious={runPagination.hasPrevious}
            hasNext={runPagination.hasNext}
            disabled={loading}
            onPrevious={() => setRunPage((page) => Math.max(0, page - 1))}
            onNext={() => setRunPage((page) => page + 1)}
          />
        ) : null}
      </div>
    </div>
  );
}
