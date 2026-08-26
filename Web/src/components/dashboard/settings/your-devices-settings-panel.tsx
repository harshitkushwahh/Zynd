"use client";

import type { LucideIcon } from "lucide-react";
import { Laptop, LogOut, Monitor, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DevicesPanelSkeleton } from "@/components/dashboard/settings/settings-skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldMessage } from "@/components/ui/ui-message";
import { ApiError } from "@/lib/api-client";
import {
  fetchSessions,
  revokeAllOtherSessions,
  revokeSession,
  type UserSession,
} from "@/lib/auth-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type DeviceKind = "mobile" | "laptop" | "desktop";

const deviceKindConfig: Record<DeviceKind, { icon: LucideIcon; label: string }> = {
  mobile: { icon: Smartphone, label: "Mobile" },
  laptop: { icon: Laptop, label: "Laptop" },
  desktop: { icon: Monitor, label: "PC" },
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function getDeviceKind(os: string | null): DeviceKind {
  const normalized = (os ?? "").toLowerCase();
  if (normalized === "ios" || normalized === "android") return "mobile";
  if (normalized === "macos") return "laptop";
  return "desktop";
}

function formatSessionLabel(session: UserSession) {
  const parts = [session.browser, session.os].filter(Boolean);
  return parts.length ? parts.join(" on ") : copy.settings.devicesUnknown;
}

function formatLastActive(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SessionCard({
  session,
  onRevoke,
}: {
  session: UserSession;
  onRevoke: (sessionId: string) => Promise<void>;
}) {
  const [revoking, setRevoking] = useState(false);
  const kind = getDeviceKind(session.os);
  const { icon: DeviceIcon, label: deviceLabel } = deviceKindConfig[kind];

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await onRevoke(session.id);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3.5",
        session.is_current
          ? "border-primary/25 bg-primary/5"
          : "border-border bg-muted/10"
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
          session.is_current ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
        title={deviceLabel}
      >
        <DeviceIcon className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-compact font-medium text-foreground">{formatSessionLabel(session)}</p>
          {session.is_current ? (
            <StatusBadge variant="info" showIcon={false}>
              {copy.settings.devicesThisDevice}
            </StatusBadge>
          ) : null}
        </div>
        <p className="mt-0.5 text-caption text-muted-foreground">
          {deviceLabel} · {copy.settings.devicesLastActive(formatLastActive(session.last_used_at))}
        </p>
      </div>

      {!session.is_current ? (
        <Button
          variant="outline"
          size="sm"
          disabled={revoking}
          onClick={() => void handleRevoke()}
        >
          <LogOut className="size-3.5" />
          {revoking ? copy.settings.devicesSigningOut : copy.settings.devicesSignOut}
        </Button>
      ) : null}
    </div>
  );
}

export function YourDevicesSettingsPanel() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError("");
    try {
      const result = await fetchSessions();
      setSessions(result.sessions);
    } catch (err) {
      setError(getErrorMessage(err, copy.settings.devicesLoadFailed));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (sessionId: string) => {
    try {
      await revokeSession(sessionId);
      await loadSessions(true);
    } catch (err) {
      setError(getErrorMessage(err, copy.settings.devicesRevokeFailed));
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    setError("");
    try {
      await revokeAllOtherSessions();
      await loadSessions(true);
    } catch (err) {
      setError(getErrorMessage(err, copy.settings.devicesRevokeAllFailed));
    } finally {
      setRevokingAll(false);
    }
  };

  if (loading) {
    return <DevicesPanelSkeleton />;
  }

  const otherSessions = sessions.filter((session) => !session.is_current);

  return (
    <div className="space-y-5">
      <FieldMessage message={error} />

      {sessions.length ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} onRevoke={handleRevoke} />
          ))}
        </div>
      ) : (
        <p className="text-compact text-muted-foreground">{copy.settings.devicesEmpty}</p>
      )}

      {otherSessions.length ? (
        <Button variant="outline" disabled={revokingAll} onClick={() => void handleRevokeAll()}>
          <LogOut className="size-3.5" />
          {revokingAll ? copy.settings.devicesSigningOut : copy.settings.devicesSignOutAllOthers}
        </Button>
      ) : null}
    </div>
  );
}
