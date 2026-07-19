"use client";

import type { LucideIcon } from "lucide-react";
import { Laptop, LogOut, Monitor, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminCardListSkeleton } from "@/components/ui/admin-skeletons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  fetchAdminSessions,
  revokeAdminSession,
  revokeAllOtherAdminSessions,
  type AdminUserSession,
} from "@/lib/admin-account-api";
import { ApiError } from "@/lib/api-client";
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

function formatSessionLabel(session: AdminUserSession) {
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
  session: AdminUserSession;
  onRevoke: (sessionId: string) => Promise<void>;
}) {
  const [revoking, setRevoking] = useState(false);
  const kind = getDeviceKind(session.os);
  const { icon: DeviceIcon, label: deviceLabel } = deviceKindConfig[kind];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3.5",
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
          {session.is_current ? (
            <StatusBadge variant="info" showIcon={false}>
              This device
            </StatusBadge>
          ) : null}
        </div>
        <p className="mt-0.5 text-caption text-muted-foreground">
          {deviceLabel} · Last active {formatLastActive(session.last_used_at)}
        </p>
      </div>
      {!session.is_current ? (
        <Button
          variant="outline"
          size="sm"
          disabled={revoking}
          onClick={() => {
            setRevoking(true);
            void onRevoke(session.id).finally(() => setRevoking(false));
          }}
        >
          <LogOut className="size-3.5" />
          {revoking ? "Signing out…" : "Sign out"}
        </Button>
      ) : null}
    </div>
  );
}

export function AdminDevicesSettingsPanel() {
  const [sessions, setSessions] = useState<AdminUserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminSessions();
      setSessions(result.sessions);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load sessions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (sessionId: string) => {
    try {
      await revokeAdminSession(sessionId);
      await loadSessions();
    } catch (err) {
      setError(getErrorMessage(err, "Could not sign out that device."));
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    setError("");
    try {
      await revokeAllOtherAdminSessions();
      await loadSessions();
    } catch (err) {
      setError(getErrorMessage(err, "Could not sign out other devices."));
    } finally {
      setRevokingAll(false);
    }
  };

  if (loading) {
    return <AdminCardListSkeleton count={3} lines={1} />;
  }

  const otherSessions = sessions.filter((session) => !session.is_current);

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {sessions.length ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} onRevoke={handleRevoke} />
          ))}
        </div>
      ) : (
        <p className="text-caption text-muted-foreground">No active sessions found.</p>
      )}
      {otherSessions.length ? (
        <Button variant="outline" disabled={revokingAll} onClick={() => void handleRevokeAll()}>
          <LogOut className="size-3.5" />
          {revokingAll ? "Signing out…" : "Sign out all other devices"}
        </Button>
      ) : null}
    </div>
  );
}
