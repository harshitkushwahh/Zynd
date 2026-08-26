"use client";

import { useEffect, useState } from "react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
} from "@/components/ui/admin-table";
import { Switch } from "@/components/ui/switch";

const PREFS_STORAGE_KEY = "zynd:admin-console-preferences";

type AdminConsolePreferences = {
  emailAlerts: boolean;
  compactTables: boolean;
};

const DEFAULT_PREFS: AdminConsolePreferences = {
  emailAlerts: true,
  compactTables: false,
};

const PREFERENCE_ROWS: Array<{
  key: keyof AdminConsolePreferences;
  label: string;
  description: string;
}> = [
  {
    key: "emailAlerts",
    label: "Ops email alerts",
    description:
      "Receive alerts for stuck transactions and failed jobs (when enabled server-side).",
  },
  {
    key: "compactTables",
    label: "Compact tables",
    description: "Prefer denser table layouts across the console (stored locally).",
  },
];

function loadPreferences(): AdminConsolePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AdminConsolePreferences>;
    return {
      emailAlerts: parsed.emailAlerts ?? DEFAULT_PREFS.emailAlerts,
      compactTables: parsed.compactTables ?? DEFAULT_PREFS.compactTables,
    };
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
    <div className="space-y-4">
      {saved ? (
        <AdminFeedbackMessage variant="success">Preferences saved on this device.</AdminFeedbackMessage>
      ) : null}

      <AdminDataTable minWidthClassName="w-full table-fixed">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Preference</AdminTableHeadCell>
            <AdminTableHeadCell className="w-28 text-right">Enabled</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {PREFERENCE_ROWS.map((row) => (
            <AdminTableRow key={row.key}>
              <AdminTableCell>
                <p className="font-medium text-foreground">{row.label}</p>
                <p className="mt-0.5 text-caption text-muted-foreground">{row.description}</p>
              </AdminTableCell>
              <AdminTableCell className="w-28 text-right align-middle">
                <Switch
                  checked={prefs[row.key]}
                  onCheckedChange={(checked) => update({ [row.key]: checked })}
                  aria-label={`${row.label} ${prefs[row.key] ? "on" : "off"}`}
                />
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
