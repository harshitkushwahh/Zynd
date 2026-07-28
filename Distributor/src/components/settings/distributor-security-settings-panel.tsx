"use client";

import { Laptop, LogOut, Monitor, Shield, ShieldCheck, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

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
              Sessions where you are signed in to the distributor console.
            </p>
          </div>
          {otherSessions.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 self-end sm:self-start"
              onClick={() => setSessions((prev) => prev.filter((session) => session.isCurrent))}
            >
              Sign out all other devices
            </Button>
          ) : null}
        </div>

        <ul className="space-y-3">
          {sessions.map((session) => {
            const DeviceIcon = deviceIcon(session.deviceLabel);
            return (
              <li
                key={session.id}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3.5",
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => revokeSession(session.id)}
                  >
                    <LogOut className="size-3.5" />
                    Sign out
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-4 border-t border-border pt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-compact font-semibold text-foreground">Two-factor authentication</h3>
            <p className="mt-1 text-caption text-muted-foreground">
              Add an authenticator app for an extra layer of protection when you sign in.
            </p>
          </div>
          {mfaEnabled ? (
            <StatusBadge variant="success" className="shrink-0">
              Enabled
            </StatusBadge>
          ) : (
            <StatusBadge variant="neutral" className="shrink-0">
              Not enabled
            </StatusBadge>
          )}
        </div>

        <div className="flex items-start gap-4 rounded-[var(--radius-card)] border border-border bg-muted/10 px-4 py-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-background text-muted-foreground">
            {mfaEnabled ? (
              <ShieldCheck className="size-5 text-primary" strokeWidth={2.25} />
            ) : (
              <Shield className="size-5" strokeWidth={2.25} />
            )}
          </span>
          <div className="min-w-0 space-y-3">
            <p className="text-compact text-muted-foreground">
              {mfaEnabled
                ? "Your account requires a code from your authenticator app when signing in."
                : "Two-factor is not set up on this account yet. Enrollment from the distributor console will be available soon."}
            </p>
            {!mfaEnabled ? (
              <Button type="button" size="sm" disabled>
                Set up authenticator
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
