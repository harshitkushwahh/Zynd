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
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { cn } from "@/lib/utils";
import {
  fetchMfIngestionRuns,
  fetchMfJobs,
  runMfJob,
  type MfIngestionRun,
  type MfJob,
} from "@/lib/mf-admin-api";

const ALL_PHASES = "all";
const ALL_STATUSES = "all";

type OperationsView = "jobs" | "runs";


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
  const [activeView, setActiveView] = useState<OperationsView>("jobs");
  const [listSearch, setListSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState(ALL_PHASES);
  const [runStatusFilter, setRunStatusFilter] = useState(ALL_STATUSES);
  const [jobPage, setJobPage] = useState(0);
  const [jobPageSize, setJobPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [runPage, setRunPage] = useState(0);
  const [runPageSize, setRunPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

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
    const query = listSearch.trim().toLowerCase();
    return jobs.filter((job) => {
      if (phaseFilter !== ALL_PHASES && String(job.phase) !== phaseFilter) return false;
      if (!query) return true;
      return (
        job.name.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query) ||
        job.cron.toLowerCase().includes(query)
      );
    });
  }, [listSearch, jobs, phaseFilter]);

  const jobPagination = useMemo(
    () => paginateItems(filteredJobs, jobPage, jobPageSize),
    [filteredJobs, jobPage, jobPageSize],
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
    const query = listSearch.trim().toLowerCase();

    return runs.filter((run) => {
      if (
        runStatusFilter !== ALL_STATUSES &&
        (run.status ?? "").toLowerCase() !== runStatusFilter.toLowerCase()
      ) {
        return false;
      }

      if (!query) return true;

      return (run.job_name ?? "").toLowerCase().includes(query);
    });
  }, [listSearch, runStatusFilter, runs]);

  const runPagination = useMemo(
    () => paginateItems(filteredRuns, runPage, runPageSize),
    [filteredRuns, runPage, runPageSize],
  );

  const phaseOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: ALL_PHASES, label: "All phases" },
      ...phases.map((phase) => ({
        value: String(phase),
        label: `Phase ${phase}`,
      })),
    ],
    [phases],
  );

  const runStatusOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: ALL_STATUSES, label: "All statuses" },
      ...runStatuses.map((status) => ({
        value: status,
        label: status,
      })),
    ],
    [runStatuses],
  );

  useEffect(() => {
    setJobPage(0);
  }, [listSearch, phaseFilter, jobPageSize]);

  useEffect(() => {
    setRunPage(0);
  }, [listSearch, runStatusFilter, runPageSize]);

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
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <AdminMetricCardsGrid>
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
      </AdminMetricCardsGrid>

      <Tabs
        value={activeView}
        onValueChange={(value) => setActiveView(value as OperationsView)}
        className="gap-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminSearchInput
            containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
            placeholder={activeView === "jobs" ? "Search jobs" : "Search runs"}
            value={listSearch}
            onChange={(event) => setListSearch(event.target.value)}
          />

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <AdminTabList variant="secondary">
              <AdminTabTrigger value="jobs" className="gap-2">
                <Settings2 className="size-4 shrink-0" />
                Scheduler jobs
              </AdminTabTrigger>
              <AdminTabTrigger value="runs" className="gap-2">
                <Clock3 className="size-4 shrink-0" />
                Recent runs
              </AdminTabTrigger>
            </AdminTabList>

            {activeView === "jobs" ? (
              <AdminSelect
                value={phaseFilter}
                onValueChange={setPhaseFilter}
                options={phaseOptions}
                placeholder="Phase"
                className="min-w-select-sm"
                triggerClassName="w-auto"
              />
            ) : (
              <AdminSelect
                value={runStatusFilter}
                onValueChange={setRunStatusFilter}
                options={runStatusOptions}
                placeholder="Status"
                className="min-w-select-sm"
                triggerClassName="w-auto"
              />
            )}

            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void loadData()}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <TabsContent value="jobs" className="mt-0 space-y-3">
          <AdminDataTable
          minWidth="4xl"
          footer={
            <AdminTablePagination
              page={jobPagination.page}
              totalPages={jobPagination.totalPages}
              hasPrevious={jobPagination.hasPrevious}
              hasNext={jobPagination.hasNext}
              disabled={loading}
              totalCount={filteredJobs.length}
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
              {canRunJobs ? <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell> : null}
              <AdminTableHeadCell>Job</AdminTableHeadCell>
              <AdminTableHeadCell>Phase</AdminTableHeadCell>
              <AdminTableHeadCell>Schedule</AdminTableHeadCell>
              <AdminTableHeadCell>Last run</AdminTableHeadCell>
              <AdminTableHeadCell className="text-right">Processed</AdminTableHeadCell>
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
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="runs" className="mt-0 space-y-3">
          <AdminDataTable
          minWidth="lg"
          footer={
            <AdminTablePagination
              page={runPagination.page}
              totalPages={runPagination.totalPages}
              hasPrevious={runPagination.hasPrevious}
              hasNext={runPagination.hasNext}
              disabled={loading}
              totalCount={filteredRuns.length}
              currentPageCount={runPagination.items.length}
              pageSize={runPageSize}
              onPageSizeChange={(next) => {
                setRunPageSize(next);
                setRunPage(0);
              }}
              onPrevious={() => setRunPage((page) => Math.max(0, page - 1))}
              onNext={() => setRunPage((page) => page + 1)}
            />
          }
        >
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
