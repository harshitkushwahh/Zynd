"use client";

import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_SETTINGS_TOGGLE_ROW_CLASS,
} from "@/lib/distributor-layout";

const PREFS_STORAGE_KEY = "zynd:distributor-notification-preferences";

type NotificationPreferences = {
  txnRequests: boolean;
  investorActivity: boolean;
  orderUpdates: boolean;
  emailDigest: boolean;
};

const DEFAULT_PREFS: NotificationPreferences = {
  txnRequests: true,
  investorActivity: true,
  orderUpdates: true,
  emailDigest: false,
};

function loadPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePreferences(prefs: NotificationPreferences) {
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

type PrefKey = keyof NotificationPreferences;

const PREF_ITEMS: { key: PrefKey; label: string; description: string }[] = [
  {
    key: "txnRequests",
    label: "Transaction requests",
    description: "When an investor submits a txn request that needs your action.",
  },
  {
    key: "investorActivity",
    label: "Investor activity",
    description: "Onboarding, KYC, and portfolio milestones for your clients.",
  },
  {
    key: "orderUpdates",
    label: "Order updates",
    description: "Placement, payment, and settlement status for orders you place.",
  },
  {
    key: "emailDigest",
    label: "Email digest",
    description: "A daily summary of unread console notifications.",
  },
];

export function DistributorSettingsNotificationsPanel() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  const setPref = (key: PrefKey, checked: boolean) => {
    const next = { ...prefs, [key]: checked };
    setPrefs(next);
    savePreferences(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      {saved ? (
        <p className="text-compact text-primary">Preferences saved on this device.</p>
      ) : null}

      <ul className="divide-y divide-border rounded-[var(--radius-5xl)] border border-border">
        {PREF_ITEMS.map((item) => {
          const switchId = `notification-pref-${item.key}`;
          return (
            <li
              key={item.key}
              className={DISTRIBUTOR_SETTINGS_TOGGLE_ROW_CLASS}
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor={switchId} className="text-compact font-medium text-foreground">
                  {item.label}
                </Label>
                <p className="mt-0.5 text-caption text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                id={switchId}
                checked={prefs[item.key]}
                onCheckedChange={(checked) => setPref(item.key, checked)}
                aria-label={`${item.label} notifications`}
                className="shrink-0"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
