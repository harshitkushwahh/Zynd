"use client";

import type { LucideIcon } from "lucide-react";
import { Laptop, LogOut, Monitor, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  fetchDistributorSessions,
  revokeAllOtherDistributorSessions,
  revokeDistributorSession,
  type DistributorUserSession,
} from "@/lib/distributor-account-api";
import { ApiError } from "@/lib/api-client";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

type DeviceKind = "mobile" | "laptop" | "desktop";

const deviceKindConfig: Record<DeviceKind, { icon: LucideIcon; label: string }> = {
  mobile: { icon: Smartphone, label: "Mobile" },
  laptop: { icon: Laptop, label: "Laptop" },
  desktop: { icon: Monitor, label: "PC" },
};

function getDeviceKind(os: string | null): DeviceKind {
  const normalized = (os ?? "").toLowerCase();
  if (normalized === "ios" || normalized === "android") return "mobile";
  if (normalized === "macos") return "laptop";
  return "desktop";
}

function formatSessionLabel(session: DistributorUserSession) {
  const parts = [session.browser, session.os].filter(Boolean);
  return parts.length ? parts.join(" on ") : "Unknown device";
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
  session: DistributorUserSession;
  onRevoke: (sessionId: string) => Promise<void>;
}) {
  const [revoking, setRevoking] = useState(false);
  const kind = getDeviceKind(session.os);
  const { icon: DeviceIcon, label: deviceLabel } = deviceKindConfig[kind];

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-5xl)] border px-4 py-3.5",
        session.is_current ? "border-primary/25 bg-primary/5" : "border-border bg-muted/10",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
          session.is_current ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <DeviceIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-compact font-medium text-foreground">{formatSessionLabel(session)}</p>
          {session.is_current ? <StatusBadge variant="info">This device</StatusBadge> : null}
        </div>
        <p className="mt-0.5 text-caption text-muted-foreground">
          {deviceLabel} · Last active {formatLastActive(session.last_used_at)}
        </p>
      </div>
      {!session.is_current ? (
        <DistributorActionButton
          type="button"
          variant="destructive"
          size="sm"
          className="gap-1.5"
          disabled={revoking}
          onClick={() => {
            setRevoking(true);
            void onRevoke(session.id).finally(() => setRevoking(false));
          }}
        >
          <LogOut className="size-3.5" />
          {revoking ? "Signing out…" : "Sign out"}
        </DistributorActionButton>
      ) : null}
    </li>
  );
}

export function DistributorSessionsSettingsSection() {
  const [sessions, setSessions] = useState<DistributorUserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchDistributorSessions();
      setSessions(result.sessions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (sessionId: string) => {
    try {
      await revokeDistributorSession(sessionId);
      await loadSessions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign out that device.");
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    setError("");
    try {
      await revokeAllOtherDistributorSessions();
      await loadSessions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign out other devices.");
    } finally {
      setRevokingAll(false);
    }
  };

  const otherSessions = sessions.filter((session) => !session.is_current);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-compact font-semibold text-foreground">Your devices</h3>
          <p className="mt-1 text-caption text-muted-foreground">{ZYND_MITRA_COPY.consoleSessions}</p>
        </div>
        {otherSessions.length > 0 ? (
          <DistributorActionButton
            type="button"
            variant="destructive"
            size="sm"
            className="shrink-0 self-end sm:self-start"
            disabled={revokingAll}
            onClick={() => void handleRevokeAll()}
          >
            {revokingAll ? "Signing out…" : "Sign out all other devices"}
          </DistributorActionButton>
        ) : null}
      </div>

      {error ? (
        <DistributorFeedbackMessage variant="error" onDismiss={() => setError("")}>
          {error}
        </DistributorFeedbackMessage>
      ) : null}

      {loading ? (
        <p className="text-caption text-muted-foreground">Loading active sessions…</p>
      ) : sessions.length ? (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} onRevoke={handleRevoke} />
          ))}
        </ul>
      ) : (
        <p className="text-caption text-muted-foreground">No active sessions found.</p>
      )}
    </section>
  );
}
