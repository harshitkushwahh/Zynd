"use client";

import { useEffect, useState } from "react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PREFS_STORAGE_KEY = "zynd:admin-console-preferences";

type AdminConsolePreferences = {
  defaultLanding: "overview" | "users" | "mutual-funds";
  emailAlerts: boolean;
  compactTables: boolean;
};

const DEFAULT_PREFS: AdminConsolePreferences = {
  defaultLanding: "overview",
  emailAlerts: true,
  compactTables: false,
};

function loadPreferences(): AdminConsolePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePreferences(prefs: AdminConsolePreferences) {
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

export function AdminPreferencesSettingsPanel() {
  const [prefs, setPrefs] = useState<AdminConsolePreferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  const update = (patch: Partial<AdminConsolePreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePreferences(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {saved ? (
        <AdminFeedbackMessage variant="success">Preferences saved on this device.</AdminFeedbackMessage>
      ) : null}

      <div className="space-y-2">
        <Label>Default landing page</Label>
        <Select
          value={prefs.defaultLanding}
          onValueChange={(value) =>
            update({ defaultLanding: (value ?? "overview") as AdminConsolePreferences["defaultLanding"] })
          }
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overview">Overview</SelectItem>
            <SelectItem value="users">Users</SelectItem>
            <SelectItem value="mutual-funds">Mutual Funds</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-caption text-muted-foreground">
          Used when you open the console home (stored locally in your browser).
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border p-4">
        <div>
          <p className="text-compact font-medium text-foreground">Ops email alerts</p>
          <p className="text-caption text-muted-foreground">
            Receive alerts for stuck transactions and failed jobs (when enabled server-side).
          </p>
        </div>
        <Button
          variant={prefs.emailAlerts ? "default" : "outline"}
          size="sm"
          onClick={() => update({ emailAlerts: !prefs.emailAlerts })}
        >
          {prefs.emailAlerts ? "On" : "Off"}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border p-4">
        <div>
          <p className="text-compact font-medium text-foreground">Compact tables</p>
          <p className="text-caption text-muted-foreground">
            Prefer denser table layouts across the console (stored locally).
          </p>
        </div>
        <Button
          variant={prefs.compactTables ? "default" : "outline"}
          size="sm"
          onClick={() => update({ compactTables: !prefs.compactTables })}
        >
          {prefs.compactTables ? "On" : "Off"}
        </Button>
      </div>
    </div>
  );
}
