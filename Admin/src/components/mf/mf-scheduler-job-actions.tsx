"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type MfSchedulerJobActionsProps = {
  jobName: string;
  enabled: boolean;
  actionKey: string | null;
  onRun: (jobName: string, force: boolean) => void;
};

function loadingFor(jobName: string, actionKey: string | null, force: boolean) {
  return actionKey === `${jobName}:${force ? "force" : "normal"}`;
}

export function MfSchedulerJobActions({
  jobName,
  enabled,
  actionKey,
  onRun,
}: MfSchedulerJobActionsProps) {
  const normalBusy = loadingFor(jobName, actionKey, false);
  const forceBusy = loadingFor(jobName, actionKey, true);
  const busy = normalBusy || forceBusy;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              size="sm"
              variant="outline"
              disabled={!enabled || busy}
              onClick={() => onRun(jobName, false)}
            >
              {normalBusy ? "Running…" : "Run now"}
            </Button>
          </span>
        </TooltipTrigger>
        {!enabled ? (
          <TooltipContent side="left" className="max-w-xs">
            Disabled in scheduler config (ingestion or feature flags). Fix env settings before running.
          </TooltipContent>
        ) : null}
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-caption text-muted-foreground"
              disabled={!enabled || busy}
              onClick={() => onRun(jobName, true)}
            >
              {forceBusy ? "Forcing…" : "Force run"}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          Skips dependency guard and NAV cold-start “not needed” checks. Does not bypass disabled jobs or staging
          mode rules.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
