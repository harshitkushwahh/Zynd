import type { MfRunJobResult } from "@/lib/mf-admin-api";

const SKIP_REASON_HINTS: Record<string, string> = {
  job_disabled: "Turn on MF ingestion and this job’s feature flag in backend config.",
  use_staging_pipeline:
    "Scheme staging is on — use cybrilla-scheme-ingest, then Staging tab approve/promote (not direct SQL sync).",
  scheme_staging_disabled: "Enable scheme staging (ZYND_MF_SCHEME_STAGING_ENABLED) or use cybrilla-scheme-sync.",
  scheme_sync_disabled: "Enable scheme sync (ZYND_MF_SCHEME_SYNC_ENABLED).",
  cold_start_disabled: "Enable NAV cold-start backfill in backend config.",
  not_needed: "Catalog NAV history is already deep enough; use Force run to backfill anyway.",
  already_running: "Wait for the in-progress run to finish, or clear stuck runs from Auto bootstrap.",
  nfo_mutex_busy: "An NFO job is holding the MF mutex; try again after it finishes.",
};

function readSkippedPayload(response: MfRunJobResult): {
  skipped: boolean;
  reason: string | null;
} {
  const topSkipped = response.skipped;
  const nested = response.result?.skipped;
  const skipped =
    topSkipped === 1 ||
    nested === 1 ||
    (typeof nested === "number" && nested > 0);
  const reason =
    (typeof response.reason === "string" && response.reason) ||
    (typeof response.result?.reason === "string" && response.result.reason) ||
    null;
  return { skipped, reason };
}

export function describeMfRunJobResult(
  response: MfRunJobResult,
  options?: { forced?: boolean },
): { variant: "success" | "warning"; message: string } {
  const { skipped, reason } = readSkippedPayload(response);
  const job = response.job;
  const forced = options?.forced ?? false;

  if (skipped) {
    const hint =
      (reason && SKIP_REASON_HINTS[reason]) ||
      (reason?.startsWith("dependency_")
        ? "Run prerequisite jobs first (see Depends on), or use Force run to skip the dependency guard."
        : undefined);
    const reasonLine = reason ? `Reason: ${reason.replace(/_/g, " ")}.` : "The job did not execute.";
    const forceHint =
      reason === "not_needed" || reason?.startsWith("dependency_")
        ? " Force run may still work for this case."
        : reason === "job_disabled" || reason === "use_staging_pipeline"
          ? ""
          : " Try Force run if appropriate.";
    return {
      variant: "warning",
      message: [`${job} was not run.`, reasonLine, hint, forceHint].filter(Boolean).join(" "),
    };
  }

  const processed = response.processed ?? response.result?.processed;
  const inserted = response.inserted ?? response.result?.inserted;
  const duration = response.duration_seconds ?? response.result?.duration_seconds;
  const parts = [`${job} completed${forced ? " (force)" : ""}.`];
  if (typeof processed === "number") parts.push(`Processed ${processed.toLocaleString()}.`);
  if (typeof inserted === "number") parts.push(`Inserted ${inserted.toLocaleString()}.`);
  if (typeof duration === "number") parts.push(`Duration ${duration}s.`);
  return { variant: "success", message: parts.join(" ") };
}

export function formatJobDependsOn(dependsOn: string[]): string {
  if (!dependsOn.length) return "None";
  return dependsOn.join(", ");
}
