"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Info,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";

import { MfStatusChip } from "@/components/mf/mf-status-chip";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from "@/components/ui/admin-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api-client";
import { env } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";
import {
  approveMfPipelineStaging,
  cancelMfPipelineRun,
  clearStuckMfPipelineRuns,
  fetchActiveMfPipelineRun,
  fetchMfPipelineRun,
  previewMfPipeline,
  resumeMfPipelineRun,
  retryMfPipelineStep,
  startMfPipeline,
  type MfPipelineHealthDiff,
  type MfPipelineMode,
  type MfPipelinePreview,
  type MfPipelineRun,
} from "@/lib/mf-admin-api";
import { cn } from "@/lib/utils";

type MfPipelineAutoPanelProps = {
  canRun: boolean;
  onCompleted?: () => void;
  onOpenStagingTab?: () => void;
};

const PIPELINE_INFO_DESCRIPTION =
  "Runs MF ingestion jobs from the admin console, same orchestration as terminal scripts, with pause/resume and staging approval when manual promote is required.";

const PIPELINE_MODE_OPTIONS: { value: MfPipelineMode; label: string; description: string }[] = [
  { value: "full", label: "Full bootstrap", description: "Staging, all scheduler jobs, compliance, health" },
  { value: "after-ingest", label: "After ingest", description: "Validate → promote → post-ingest jobs" },
  { value: "staging-only", label: "Staging only", description: "Ingest and validate schemes (no promote)" },
  {
    value: "nav-analytics-only",
    label: "NAV + analytics",
    description: "Cold-start, metrics, ranks — skip scheme staging",
  },
  { value: "health-repair", label: "Health repair", description: "Lifecycle, NAV, metrics, min amounts, health" },
  { value: "bootstrap", label: "Bootstrap (legacy)", description: "Same as after-ingest mode name" },
];

const POLL_STOP_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

const PIPELINE_PANEL_RADIUS = "rounded-[var(--radius-5xl)]";
const PIPELINE_INNER_CARD_CLASS =
  "rounded-3xl border border-border/70 bg-background shadow-sm ring-0";

const FINAL_COUNT_FIELDS: { key: string; label: string }[] = [
  { key: "products", label: "Products" },
  { key: "funds", label: "Funds" },
  { key: "active", label: "Active products" },
  { key: "amcs", label: "Empanelled AMCs" },
  { key: "nav_rows", label: "NAV rows" },
  { key: "metrics", label: "NAV metrics" },
  { key: "derived_attrs", label: "Derived attributes" },
  { key: "compliance", label: "Compliance facts" },
  { key: "aum_rows", label: "AUM rows" },
  { key: "ter_rows", label: "TER rows" },
  { key: "funds_with_min_sip", label: "Funds with min SIP" },
  { key: "funds_with_investment_details", label: "Funds with investment details" },
];

const HEALTH_TOTAL_LABELS: Record<"critical" | "warning" | "public_blocked", string> = {
  critical: "Critical",
  warning: "Warning",
  public_blocked: "Public blocked",
};

function formatPipelineCount(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

function formatHealthDelta(delta: number) {
  if (delta === 0) return "0";
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;
}

function healthDeltaTone(delta: number, severity?: string | null) {
  if (delta < 0) return "text-success";
  if (delta === 0) return "text-muted-foreground";
  if (severity === "critical") return "text-destructive";
  return "text-warning";
}

function PipelineFinalCountsCard({ counts }: { counts: Record<string, unknown> }) {
  return (
    <Card className={cn(PIPELINE_INNER_CARD_CLASS, "h-full")}>
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div>
          <p className="font-medium text-foreground">Final counts</p>
          <p className="text-caption text-muted-foreground">Catalog snapshot after pipeline completion</p>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
          {FINAL_COUNT_FIELDS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-2xl border border-border/70 bg-muted/15 px-3 py-2.5"
            >
              <dt className="text-[11px] leading-snug text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-body font-semibold tabular-nums text-foreground">
                {formatPipelineCount(counts[key])}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function PipelineHealthDiffCard({ diff }: { diff: MfPipelineHealthDiff }) {
  return (
    <Card className={cn(PIPELINE_INNER_CARD_CLASS, "h-full")}>
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div>
          <p className="font-medium text-foreground">Health diff</p>
          <p className="text-caption text-muted-foreground">Issue counts before and after bootstrap</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["critical", "warning", "public_blocked"] as const).map((key) => {
            const delta = diff.totals_delta[key] ?? diff.after_totals[key] - diff.before_totals[key];
            return (
              <div
                key={key}
                className="rounded-2xl border border-border/70 bg-muted/15 px-3 py-2.5"
              >
                <p className="text-[11px] text-muted-foreground">{HEALTH_TOTAL_LABELS[key]}</p>
                <p className="mt-1 text-caption font-medium tabular-nums text-foreground">
                  {diff.before_totals[key].toLocaleString()}
                  <span className="mx-1 text-muted-foreground">→</span>
                  {diff.after_totals[key].toLocaleString()}
                </p>
                <p className={cn("mt-0.5 text-caption font-medium tabular-nums", healthDeltaTone(delta, key))}>
                  {formatHealthDelta(delta)}
                </p>
              </div>
            );
          })}
        </div>

        {diff.changes.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70">
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-caption">
                <thead className="sticky top-0 bg-muted/40 backdrop-blur-sm">
                  <tr className="border-b border-border/70 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Check</th>
                    <th className="px-3 py-2 text-right font-medium">Before</th>
                    <th className="px-3 py-2 text-right font-medium">After</th>
                    <th className="px-3 py-2 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.changes.map((change) => (
                    <tr key={change.key} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-foreground">{change.label}</span>
                          {change.severity ? (
                            <MfStatusChip
                              label={change.severity}
                              tone={change.severity === "critical" ? "danger" : "warning"}
                              showIcon={false}
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {change.before.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {change.after.toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-medium tabular-nums",
                          healthDeltaTone(change.delta, change.severity),
                        )}
                      >
                        {formatHealthDelta(change.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-caption text-muted-foreground">No per-check count changes.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PipelineStatusCard({ children }: { children: ReactNode }) {
  return (
    <Card className={PIPELINE_INNER_CARD_CLASS}>
      <CardContent className="space-y-3 p-4">{children}</CardContent>
    </Card>
  );
}

function PipelineDryRunPreview({
  preview,
  excludedSteps,
  starting,
  isRunning,
  onToggleSchedulerStep,
}: {
  preview: MfPipelinePreview;
  excludedSteps: Set<string>;
  starting: boolean;
  isRunning: boolean;
  onToggleSchedulerStep: (stepKey: string, included: boolean) => void;
}) {
  const hasSchedulerOverrides = preview.scheduler_mapped_steps.length > 0;

  return (
    <Card className={PIPELINE_INNER_CARD_CLASS}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div className="space-y-1">
            <p className="font-medium text-foreground">Dry run preview</p>
            <p className="text-caption text-muted-foreground">
              {preview.included_step_count} of {preview.step_count} steps included · mode{" "}
              <span className="font-mono text-foreground/80">{preview.mode}</span>
            </p>
          </div>
          <MfStatusChip
            label={preview.can_start ? "Ready to start" : "Blocked"}
            tone={preview.can_start ? "success" : "warning"}
          />
        </div>

        {preview.blockers.length > 0 ? (
          <AdminFeedbackMessage variant="warning">
            <ul className="list-disc space-y-1 pl-4">
              {preview.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </AdminFeedbackMessage>
        ) : null}

        <div
          className={cn(
            "grid min-h-0 gap-4",
            hasSchedulerOverrides ? "lg:grid-cols-2" : "grid-cols-1",
          )}
        >
          {hasSchedulerOverrides ? (
            <div className="flex min-h-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption font-medium text-foreground">Scheduler step overrides</p>
                <span className="text-[11px] text-muted-foreground">
                  {preview.scheduler_mapped_steps.length} jobs
                </span>
              </div>
              <div className="max-h-64 min-h-[10rem] overflow-y-auto rounded-2xl border border-border/70 bg-muted/15 p-2">
                <ul className="space-y-1">
                  {preview.scheduler_mapped_steps.map((step) => {
                    const included = !excludedSteps.has(step.key);
                    return (
                      <li
                        key={step.key}
                        className={cn(
                          "flex items-start gap-2 rounded-xl px-2 py-2 text-caption transition-colors",
                          included ? "bg-background/80" : "bg-muted/30 opacity-70",
                        )}
                      >
                        <input
                          id={`pipeline-step-${step.key}`}
                          type="checkbox"
                          checked={included}
                          disabled={starting || isRunning}
                          onChange={(event) => onToggleSchedulerStep(step.key, event.target.checked)}
                          className="mt-0.5 shrink-0"
                        />
                        <label htmlFor={`pipeline-step-${step.key}`} className="min-w-0 flex-1 cursor-pointer">
                          <span className="block text-foreground">{step.label}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                            {step.scheduler_job}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Unchecked steps are skipped for this run. Tonight&apos;s cron will still run them.
              </p>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-caption font-medium text-foreground">Execution plan</p>
              <span className="text-[11px] text-muted-foreground">{preview.effective_steps.length} steps</span>
            </div>
            <div className="max-h-64 min-h-[10rem] overflow-y-auto rounded-2xl border border-border/70 bg-muted/15 p-2">
              <ul className="space-y-1">
                {preview.effective_steps.map((step, index) => (
                  <li
                    key={step.key}
                    className={cn(
                      "flex items-start gap-2 rounded-xl px-2 py-2 text-caption",
                      step.included ? "bg-background/80" : "bg-muted/30 opacity-60",
                    )}
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-foreground", !step.included && "line-through")}>{step.label}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{step.key}</p>
                    </div>
                    {!step.included ? (
                      <MfStatusChip label="Skipped" tone="neutral" showIcon={false} />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineModeSelect({
  value,
  disabled,
  onValueChange,
}: {
  value: MfPipelineMode;
  disabled: boolean;
  onValueChange: (value: MfPipelineMode) => void;
}) {
  const selected = PIPELINE_MODE_OPTIONS.find((item) => item.value === value);

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onValueChange(next as MfPipelineMode);
      }}
    >
      <SelectTrigger
        size="sm"
        className="h-8 min-w-[11rem] rounded-2xl border-border/80 bg-background px-2.5 text-caption shadow-none"
        aria-label="Pipeline mode"
      >
        <SelectValue placeholder="Pipeline mode">
          {selected?.label ?? "Pipeline mode"}
        </SelectValue>
      </SelectTrigger>
        <SelectContent align="end" className="rounded-2xl">
          {PIPELINE_MODE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
    </Select>
  );
}

function PipelineInfoTooltip({
  selectedMode,
  showIdleHint,
}: {
  selectedMode?: (typeof PIPELINE_MODE_OPTIONS)[number];
  showIdleHint: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="About Auto bootstrap"
          >
            <Info className="size-4" />
          </Button>
        }
      />
      <TooltipContent
        side="top"
        align="end"
        className="flex w-80 max-w-[min(20rem,calc(100vw-2rem))] flex-col items-start gap-0 px-3.5 py-3 text-xs leading-relaxed"
      >
        <div className="space-y-3">
          <p className="text-pretty text-background/95">{PIPELINE_INFO_DESCRIPTION}</p>

          {selectedMode ? (
            <div className="space-y-1.5 border-t border-background/20 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-background/60">
                Pipeline mode
              </p>
              <p className="font-medium text-background">{selectedMode.label}</p>
              <p className="text-pretty text-background/85">{selectedMode.description}</p>
            </div>
          ) : null}

          {showIdleHint ? (
            <div className="border-t border-background/20 pt-3">
              <p className="text-pretty text-background/85">
                No pipeline run in progress. Use <span className="font-medium text-background">Auto run</span>{" "}
                to bootstrap catalog data end-to-end.
              </p>
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function logTone(level: string) {
  if (level === "success") return "text-success";
  if (level === "error") return "text-destructive";
  if (level === "warning") return "text-warning";
  return "text-muted-foreground";
}

export function MfPipelineAutoPanel({ canRun, onCompleted, onOpenStagingTab }: MfPipelineAutoPanelProps) {
  const [run, setRun] = useState<MfPipelineRun | null>(null);
  const [mode, setMode] = useState<MfPipelineMode>("full");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [approvingStaging, setApprovingStaging] = useState(false);
  const [retryingStepKey, setRetryingStepKey] = useState<string | null>(null);
  const [clearingStuck, setClearingStuck] = useState(false);
  const [stuckCleared, setStuckCleared] = useState<number | null>(null);
  const [preview, setPreview] = useState<MfPipelinePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [excludedSteps, setExcludedSteps] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const completedNotifiedRef = useRef<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const refreshRun = useCallback(async (runId: string) => {
    const next = await fetchMfPipelineRun(runId);
    setRun(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadActive() {
      setLoading(true);
      setError("");
      try {
        const active = await fetchActiveMfPipelineRun();
        if (!cancelled) setRun(active);
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
          setError(getErrorMessage(err, "Could not load pipeline status."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadActive();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!run || POLL_STOP_STATUSES.has(run.status)) return;

    const timer = window.setInterval(() => {
      void refreshRun(run.run_id).catch((err) => {
        setError(getErrorMessage(err, "Could not refresh pipeline status."));
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [refreshRun, run?.run_id, run?.status]);

  useEffect(() => {
    if (!run || run.status !== "succeeded") return;
    if (completedNotifiedRef.current === run.run_id) return;
    completedNotifiedRef.current = run.run_id;
    onCompleted?.();
  }, [onCompleted, run]);

  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [run?.logs.length]);

  const skipSteps = useMemo(() => Array.from(excludedSteps), [excludedSteps]);

  useEffect(() => {
    setPreview(null);
    setExcludedSteps(new Set());
  }, [mode]);

  const handlePreview = async () => {
    setPreviewing(true);
    setError("");
    try {
      const next = await previewMfPipeline(mode, skipSteps);
      setPreview(next);
      setExcludedSteps(new Set(next.skip_steps));
    } catch (err) {
      setError(getErrorMessage(err, "Could not preview pipeline."));
    } finally {
      setPreviewing(false);
    }
  };

  const toggleSchedulerStep = (stepKey: string, included: boolean) => {
    setExcludedSteps((current) => {
      const next = new Set(current);
      if (included) {
        next.delete(stepKey);
      } else {
        next.add(stepKey);
      }
      return next;
    });
  };

  const handleStart = async (confirmProduction = false) => {
    if (!canRun) return;
    setStarting(true);
    setError("");
    setStuckCleared(null);
    setConfirmOpen(false);
    try {
      const started = await startMfPipeline(mode, confirmProduction, skipSteps, true);
      setPreview(null);
      setRun(await refreshRun(started.run_id));
    } catch (err) {
      setError(getErrorMessage(err, "Could not start MF pipeline."));
    } finally {
      setStarting(false);
    }
  };

  const handleStartRequest = () => {
    if (!canRun) return;
    if (env.appEnv === "production" || preview?.flags.requires_production_confirm) {
      setConfirmOpen(true);
      return;
    }
    void handleStart(false);
  };

  const handleCancel = async () => {
    if (!run || !canRun) return;
    setCancelling(true);
    setError("");
    try {
      const cancelledRun = await cancelMfPipelineRun(run.run_id);
      setRun(cancelledRun);
    } catch (err) {
      setError(getErrorMessage(err, "Could not cancel pipeline."));
    } finally {
      setCancelling(false);
    }
  };

  const handleResume = async () => {
    if (!run || !canRun) return;
    setResuming(true);
    setError("");
    setStuckCleared(null);
    try {
      await resumeMfPipelineRun(run.run_id);
      setRun(await refreshRun(run.run_id));
    } catch (err) {
      setError(getErrorMessage(err, "Could not resume pipeline."));
    } finally {
      setResuming(false);
    }
  };

  const handleRetryStep = async (stepKey: string) => {
    if (!run || !canRun) return;
    setRetryingStepKey(stepKey);
    setError("");
    setStuckCleared(null);
    try {
      await retryMfPipelineStep(run.run_id, stepKey);
      setRun(await refreshRun(run.run_id));
    } catch (err) {
      setError(getErrorMessage(err, "Could not retry pipeline step."));
    } finally {
      setRetryingStepKey(null);
    }
  };

  const handleApproveStaging = async () => {
    if (!run || !canRun) return;
    setApprovingStaging(true);
    setError("");
    try {
      const approved = await approveMfPipelineStaging(run.run_id);
      setRun(await refreshRun(approved.run_id));
    } catch (err) {
      setError(getErrorMessage(err, "Could not approve staging batch."));
    } finally {
      setApprovingStaging(false);
    }
  };

  const handleClearStuck = async () => {
    if (!canRun) return;
    setClearingStuck(true);
    setError("");
    try {
      const result = await clearStuckMfPipelineRuns();
      setStuckCleared(result.cleaned);
    } catch (err) {
      setError(getErrorMessage(err, "Could not clear stuck ingestion runs."));
    } finally {
      setClearingStuck(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (!run) return "Idle";
    if (run.status === "running") return "Running";
    if (run.status === "paused") return "Paused";
    if (run.status === "succeeded") return "Completed";
    if (run.status === "failed") return "Failed";
    if (run.status === "cancelled") return "Cancelled";
    return run.status;
  }, [run]);

  const isRunning = run?.status === "running" || run?.status === "pending";
  const awaitingStaging = Boolean(run?.can_approve_staging && run.staging_batch_uuid && !isRunning);
  const showResume = Boolean(run?.can_resume && !isRunning && !awaitingStaging);
  const failedStep = run?.steps.find((step) => step.status === "failed") ?? null;
  const maintenanceWindow = preview?.flags.maintenance_window;
  const startBlocked = preview ? !preview.can_start : false;

  const selectedMode = PIPELINE_MODE_OPTIONS.find((item) => item.value === mode);

  return (
    <div className={cn("overflow-hidden border border-border/80 bg-card shadow-sm", PIPELINE_PANEL_RADIUS)}>
      <div className="flex flex-col gap-4 border-b border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Terminal className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-body font-semibold text-foreground">Auto bootstrap</h3>
            {selectedMode ? (
              <p className="text-caption leading-relaxed text-muted-foreground">{selectedMode.description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {canRun ? (
            <PipelineModeSelect
              value={mode}
              disabled={starting || isRunning || showResume || awaitingStaging}
              onValueChange={setMode}
            />
          ) : null}
          {canRun ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={previewing}
                onClick={() => void handlePreview()}
              >
                {previewing ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Previewing…
                  </>
                ) : (
                  <>
                    <Eye className="size-3.5" />
                    Dry run
                  </>
                )}
              </Button>
              <Button
                size="sm"
                disabled={starting || isRunning || showResume || awaitingStaging || startBlocked}
                onClick={() => handleStartRequest()}
              >
                {starting ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    Auto run
                  </>
                )}
              </Button>
              {awaitingStaging ? (
                <Button size="sm" disabled={approvingStaging} onClick={() => void handleApproveStaging()}>
                  {approvingStaging ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Approving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Approve
                    </>
                  )}
                </Button>
              ) : null}
              {showResume ? (
                <Button size="sm" variant="secondary" disabled={resuming} onClick={() => void handleResume()}>
                  {resuming ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Resuming…
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-3.5" />
                      Resume
                    </>
                  )}
                </Button>
              ) : null}
              {isRunning && run ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancelling}
                  onClick={() => void handleCancel()}
                >
                  {cancelling ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Cancelling…
                    </>
                  ) : (
                    <>
                      <Square className="size-3.5" />
                      Cancel
                    </>
                  )}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={clearingStuck}
                onClick={() => void handleClearStuck()}
              >
                {clearingStuck ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Clearing…
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    Clear stuck
                  </>
                )}
              </Button>
            </>
          ) : (
            <p className="text-caption text-muted-foreground">Requires mf.pipeline.run permission.</p>
          )}
          <PipelineInfoTooltip selectedMode={selectedMode} showIdleHint={!run && !loading} />
        </div>
      </div>

      <div className="space-y-4 bg-muted/10 p-4 sm:p-5">
      {stuckCleared !== null ? (
        <AdminFeedbackMessage variant="success">
          Cleared {stuckCleared} stuck ingestion run{stuckCleared === 1 ? "" : "s"}.
        </AdminFeedbackMessage>
      ) : null}

      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      {maintenanceWindow?.enforced && !maintenanceWindow.within_window ? (
        <AdminFeedbackMessage variant="warning">
          Manual pipeline runs are allowed {maintenanceWindow.start}–{maintenanceWindow.end} IST only.
          {maintenanceWindow.opens_at_ist ? (
            <>
              {" "}
              Next window opens at{" "}
              <span className="font-mono">{maintenanceWindow.opens_at_ist}</span>.
            </>
          ) : null}
        </AdminFeedbackMessage>
      ) : null}

      {awaitingStaging ? (
        <AdminFeedbackMessage variant="warning">
          <div className="space-y-2">
            <p>
              Pipeline paused for staging approval. Batch{" "}
              <span className="font-mono">{run?.staging_batch_uuid}</span> must be approved before promote
              continues.
            </p>
            {onOpenStagingTab ? (
              <Button size="sm" variant="outline" onClick={onOpenStagingTab}>
                Open Staging tab
              </Button>
            ) : null}
          </div>
        </AdminFeedbackMessage>
      ) : null}

      {preview ? (
        <PipelineDryRunPreview
          preview={preview}
          excludedSteps={excludedSteps}
          starting={starting}
          isRunning={isRunning}
          onToggleSchedulerStep={toggleSchedulerStep}
        />
      ) : null}

      {loading ? (
        <PipelineStatusCard>
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Checking pipeline status…
          </div>
        </PipelineStatusCard>
      ) : run ? (
        <div className="space-y-4">
          <PipelineStatusCard>
            <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
              <span className="font-medium text-foreground">{statusLabel}</span>
              <span className="text-muted-foreground">
                {run.progress.completed_steps} / {run.progress.total_steps} steps ({run.progress.percent}
                %)
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300",
                  run.status === "paused" ? "bg-warning" : "bg-primary"
                )}
                style={{ width: `${run.progress.percent}%` }}
              />
            </div>
            {run.current_step_key ? (
              <p className="text-caption text-muted-foreground">
                Current step: <span className="font-mono text-foreground">{run.current_step_key}</span>
              </p>
            ) : null}
            {run.error && !awaitingStaging ? (
              <AdminFeedbackMessage variant="destructive">{run.error}</AdminFeedbackMessage>
            ) : null}
            {run.can_resume && failedStep && canRun ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retryingStepKey !== null || isRunning}
                  onClick={() => void handleRetryStep(failedStep.key)}
                >
                  {retryingStepKey === failedStep.key ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Retrying…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-3.5" />
                      Retry step: {failedStep.label}
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </PipelineStatusCard>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-stretch">
            <div className="flex min-h-0 flex-col gap-2">
              <p className="text-caption font-medium text-foreground">Steps</p>
              <ul className="h-96 min-h-0 space-y-1 overflow-y-auto rounded-2xl border border-border/80 bg-muted/20 p-2">
                {run.steps.map((step) => (
                  <li
                    key={step.key}
                    className="flex items-start gap-2 rounded-xl px-2 py-1.5 text-caption"
                  >
                    {step.status === "succeeded" ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                    ) : step.status === "failed" ? (
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    ) : step.status === "running" ? (
                      <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
                    ) : (
                      <span className="mt-1 size-3.5 shrink-0 rounded-full border border-border" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground">{step.label}</p>
                      {step.error ? (
                        <p className="mt-0.5 text-destructive">{step.error}</p>
                      ) : null}
                      {step.ingestion_run_uuid ? (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                          run {step.ingestion_run_uuid}
                        </p>
                      ) : null}
                    </div>
                    {step.status === "failed" && run.can_resume && canRun && !isRunning ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 px-2"
                        disabled={retryingStepKey !== null}
                        onClick={() => void handleRetryStep(step.key)}
                      >
                        {retryingStepKey === step.key ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
              <p className="text-caption font-medium text-foreground">Console</p>
              <div
                ref={logContainerRef}
                className="h-96 min-h-0 overflow-y-auto rounded-2xl border border-border/80 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-100"
              >
                {run.logs.length === 0 ? (
                  <p className="text-zinc-400">Waiting for log output…</p>
                ) : (
                  run.logs.map((line, index) => (
                    <div key={`${line.timestamp}-${index}`} className={cn("whitespace-pre-wrap", logTone(line.level))}>
                      {line.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {run.final_counts || run.health_diff ? (
            <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
              {run.final_counts ? <PipelineFinalCountsCard counts={run.final_counts} /> : null}
              {run.health_diff ? <PipelineHealthDiffCard diff={run.health_diff} /> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <PipelineStatusCard>
          <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
            <span className="font-medium text-muted-foreground">Idle</span>
            <span className="text-muted-foreground">No run in progress</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-0 rounded-full bg-muted-foreground/30" />
          </div>
        </PipelineStatusCard>
      )}

      </div>

      <AdminDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AdminDialogContent size="md">
          <AdminDialogHeader
            title="Run pipeline in production?"
            description="This executes many ingestion jobs and may take hours. Confirm only during the configured maintenance window."
            icon={AlertTriangle}
            iconTone="warning"
          />
          <AdminDialogBody>
            <p className="text-caption text-muted-foreground">
              Mode: <span className="font-medium text-foreground">{selectedMode?.label ?? mode}</span> (
              {preview?.step_count ?? "unknown"} steps)
            </p>
          </AdminDialogBody>
          <AdminDialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button disabled={starting} onClick={() => void handleStart(true)}>
              {starting ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Starting…
                </>
              ) : (
                "Confirm and run"
              )}
            </Button>
          </AdminDialogFooter>
        </AdminDialogContent>
      </AdminDialog>
    </div>
  );
}
