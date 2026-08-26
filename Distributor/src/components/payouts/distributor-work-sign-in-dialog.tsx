"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

import type { DistributorWorkSignInPayload } from "@/contexts/distributor-work-session-context";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_DISTRIBUTOR_WORK_ATTENDANCE_CONFIG,
  type DistributorWorkAttendanceConfig,
  type DistributorWorkModeId,
} from "@/lib/distributor-work-attendance-config";
import { fetchDistributorWorkConfig } from "@/lib/distributor-work-api";
import {
  DistributorWorkGeolocationError,
  formatWorkGeolocation,
  requestDistributorWorkGeolocation,
  type DistributorWorkGeolocation,
} from "@/lib/distributor-work-geolocation";
import { cn } from "@/lib/utils";

type DistributorWorkSignInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: (payload: DistributorWorkSignInPayload) => Promise<void>;
};

export function DistributorWorkSignInDialog({
  open,
  onOpenChange,
  onSignIn,
}: DistributorWorkSignInDialogProps) {
  const [config, setConfig] = useState<DistributorWorkAttendanceConfig>(
    DEFAULT_DISTRIBUTOR_WORK_ATTENDANCE_CONFIG,
  );
  const defaultTimeSlotId = config.timeSlots[2]?.id ?? config.timeSlots[0]?.id ?? "full-day";
  const defaultWorkModeId = config.workModes[0]?.id ?? "office";

  const [workSiteId, setWorkSiteId] = useState<"office" | "client-site">("office");
  const [workModeId, setWorkModeId] = useState<DistributorWorkModeId>(defaultWorkModeId);
  const [timeSlotId, setTimeSlotId] = useState(defaultTimeSlotId);
  const [remarks, setRemarks] = useState("");
  const [geolocation, setGeolocation] = useState<DistributorWorkGeolocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const selectedTimeSlot = useMemo(
    () => config.timeSlots.find((slot) => slot.id === timeSlotId),
    [config.timeSlots, timeSlotId],
  );

  const resetForm = () => {
    setWorkSiteId("office");
    setWorkModeId(defaultWorkModeId);
    setTimeSlotId(defaultTimeSlotId);
    setRemarks("");
    setGeolocation(null);
    setLocationLoading(false);
    setLocationError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    void fetchDistributorWorkConfig()
      .then(setConfig)
      .catch(() => setConfig(DEFAULT_DISTRIBUTOR_WORK_ATTENDANCE_CONFIG));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLocationLoading(true);
    setLocationError(null);

    void requestDistributorWorkGeolocation()
      .then((coords) => {
        if (!cancelled) {
          setGeolocation(coords);
          setLocationError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setGeolocation(null);
          setLocationError(
            error instanceof DistributorWorkGeolocationError
              ? error.message
              : "Could not read your location.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLocationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const retryLocation = () => {
    setLocationLoading(true);
    setLocationError(null);
    void requestDistributorWorkGeolocation()
      .then((coords) => {
        setGeolocation(coords);
        setLocationError(null);
      })
      .catch((error: unknown) => {
        setGeolocation(null);
        setLocationError(
          error instanceof DistributorWorkGeolocationError
            ? error.message
            : "Could not read your location.",
        );
      })
      .finally(() => setLocationLoading(false));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!geolocation) return;

    void onSignIn({
      workSiteId,
      workModeId,
      timeSlotId,
      remarks: remarks.trim() || null,
      geolocation,
    }).then(() => handleOpenChange(false));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Sign in for work</DialogTitle>
        <DialogDescription>Record your work location and shift details</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-md gap-0 p-0">
        <form className="distributor-work-sign-in-dialog" onSubmit={handleSubmit}>
          <div className="distributor-work-sign-in-dialog__header">
            <DialogTitle className="distributor-work-sign-in-dialog__title">Sign in for work</DialogTitle>
            <DialogDescription className="distributor-work-sign-in-dialog__description">
              Confirm your location, work site, and assigned shift before starting your day.
            </DialogDescription>
          </div>

          <div className="distributor-work-sign-in-dialog__fields">
            <div className="distributor-work-sign-in-dialog__location-card">
              <div className="distributor-work-sign-in-dialog__location-head">
                <span className="distributor-work-sign-in-dialog__location-icon" aria-hidden>
                  <MapPin className="size-4" strokeWidth={2.25} />
                </span>
                <div>
                  <p className="distributor-work-sign-in-dialog__location-label">Current location</p>
                  <p className="distributor-work-sign-in-dialog__location-hint">
                    Required for attendance verification
                  </p>
                </div>
              </div>
              {locationLoading ? (
                <p className="distributor-work-sign-in-dialog__location-value" role="status">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Reading GPS…
                </p>
              ) : geolocation ? (
                <p className="distributor-work-sign-in-dialog__location-value tabular-nums">
                  {formatWorkGeolocation(geolocation)}
                </p>
              ) : (
                <div className="distributor-work-sign-in-dialog__location-error-wrap">
                  <p className="distributor-work-sign-in-dialog__location-error" role="alert">
                    {locationError ?? "Location unavailable"}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={retryLocation}>
                    Retry location
                  </Button>
                </div>
              )}
            </div>

            <div className="distributor-work-sign-in-dialog__field">
              <Label htmlFor="work-site">Work site</Label>
              <Select
                value={workSiteId}
                onValueChange={(value) => {
                  if (value === "office" || value === "client-site") setWorkSiteId(value);
                }}
              >
                <SelectTrigger id="work-site" className="w-full">
                  <SelectValue placeholder="Select work site" />
                </SelectTrigger>
                <SelectContent>
                  {config.workSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="distributor-work-sign-in-dialog__field-hint">
                {config.workSites.find((site) => site.id === workSiteId)?.payFactorHint}
              </p>
            </div>

            <div className="distributor-work-sign-in-dialog__field">
              <Label htmlFor="work-mode">Work mode</Label>
              <Select
                value={workModeId}
                onValueChange={(value) => {
                  if (value) setWorkModeId(value as DistributorWorkModeId);
                }}
              >
                <SelectTrigger id="work-mode" className="w-full">
                  <SelectValue placeholder="Select work mode" />
                </SelectTrigger>
                <SelectContent>
                  {config.workModes.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="distributor-work-sign-in-dialog__field-hint">
                {config.workModes.find((mode) => mode.id === workModeId)?.description}
              </p>
            </div>

            <div className="distributor-work-sign-in-dialog__field">
              <Label htmlFor="time-slot">Time slot</Label>
              <Select
                value={timeSlotId}
                onValueChange={(value) => {
                  if (value) setTimeSlotId(value);
                }}
              >
                <SelectTrigger id="time-slot" className="w-full">
                  <SelectValue placeholder="Select time slot" />
                </SelectTrigger>
                <SelectContent>
                  {config.timeSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {slot.label} · {slot.startTime}–{slot.endTime}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTimeSlot ? (
                <p className="distributor-work-sign-in-dialog__field-hint">
                  Company shift: {selectedTimeSlot.startTime} to {selectedTimeSlot.endTime}
                </p>
              ) : null}
            </div>

            <div className="distributor-work-sign-in-dialog__field">
              <Label htmlFor="work-remarks">Remarks (optional)</Label>
              <textarea
                id="work-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Client visit, branch meeting, travel note…"
                rows={3}
                className={cn(
                  "min-h-[4.5rem] w-full min-w-0 resize-y rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 text-body transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-compact dark:bg-input/30",
                )}
              />
            </div>
          </div>

          <div className="distributor-work-sign-in-dialog__actions">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <DistributorActionButton type="submit" variant="primary" disabled={!geolocation || locationLoading}>
              Sign in
            </DistributorActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
