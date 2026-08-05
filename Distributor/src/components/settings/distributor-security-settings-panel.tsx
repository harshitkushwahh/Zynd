"use client";

import { Laptop, LogOut, Monitor, Shield, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type DemoSession = {
  id: string;
  label: string;
  deviceLabel: string;
  lastActive: string;
  isCurrent: boolean;
};

const DEMO_SESSIONS: DemoSession[] = [
  {
    id: "current",
    label: "Chrome on macOS",
    deviceLabel: "Laptop",
    lastActive: "Active now",
    isCurrent: true,
  },
  {
    id: "mobile",
    label: "Safari on iOS",
    deviceLabel: "Mobile",
    lastActive: "Jul 24, 2026, 9:14 AM",
    isCurrent: false,
  },
];

function deviceIcon(deviceLabel: string) {
  if (deviceLabel === "Mobile") return Smartphone;
  if (deviceLabel === "Laptop") return Laptop;
  return Monitor;
}

export function DistributorSecuritySettingsPanel() {
  const [sessions, setSessions] = useState(DEMO_SESSIONS);
  const mfaEnabled = false;

  const otherSessions = useMemo(
    () => sessions.filter((session) => !session.isCurrent),
    [sessions],
  );

  const revokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-compact font-semibold text-foreground">Your devices</h3>
            <p className="mt-1 text-caption text-muted-foreground">
              {ZYND_MITRA_COPY.consoleSessions}
            </p>
          </div>
          {otherSessions.length > 0 ? (
            <DistributorActionButton
              type="button"
              variant="destructive"
              size="sm"
              className="shrink-0 self-end sm:self-start"
              onClick={() => setSessions((prev) => prev.filter((session) => session.isCurrent))}
            >
              Sign out all other devices
            </DistributorActionButton>
          ) : null}
        </div>

        <ul className="space-y-3">
          {sessions.map((session) => {
            const DeviceIcon = deviceIcon(session.deviceLabel);
            return (
              <li
                key={session.id}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-5xl)] border px-4 py-3.5",
                  session.isCurrent ? "border-primary/25 bg-primary/5" : "border-border bg-muted/10",
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
                    session.isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <DeviceIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-compact font-medium text-foreground">{session.label}</p>
                    {session.isCurrent ? (
                      <StatusBadge variant="info">This device</StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {session.deviceLabel} · Last active {session.lastActive}
                  </p>
                </div>
                {!session.isCurrent ? (
                  <DistributorActionButton
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => revokeSession(session.id)}
                  >
                    <LogOut className="size-3.5" />
                    Sign out
                  </DistributorActionButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="border-t border-border pt-8">
        <Card className="overflow-hidden bg-card shadow-sm ring-border">
          <div className="flex items-start gap-2.5 border-b border-border px-4 py-3.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Shield className="size-4" aria-hidden strokeWidth={2.25} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-compact font-semibold text-foreground">Two-factor authentication</h3>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  Add an authenticator app for an extra layer of protection when you sign in.
                </p>
              </div>
              <StatusBadge variant={mfaEnabled ? "success" : "warning"}>
                {mfaEnabled ? "Enabled" : "Not enabled"}
              </StatusBadge>
            </div>
          </div>

          <div className="px-4 py-4">
            <div className="flex flex-col gap-4 rounded-[var(--radius-5xl)] border border-border bg-muted/10 p-4 sm:flex-row sm:items-center">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] ring-1 ring-border",
                  mfaEnabled
                    ? "bg-primary/10 text-primary"
                    : "bg-warning/15 text-warning-foreground",
                )}
              >
                {mfaEnabled ? (
                  <ShieldCheck className="size-5" strokeWidth={2.25} aria-hidden />
                ) : (
                  <ShieldOff className="size-5" strokeWidth={2.25} aria-hidden />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-compact font-semibold text-foreground">
                  {mfaEnabled ? "Authenticator app is active" : "Authenticator not set up"}
                </p>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {mfaEnabled
                    ? "Your account requires a code from your authenticator app when signing in."
                    : ZYND_MITRA_COPY.console2faSoon}
                </p>
              </div>

              {!mfaEnabled ? (
                <DistributorActionButton
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="shrink-0 self-start"
                >
                  Set up authenticator
                </DistributorActionButton>
              ) : null}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
