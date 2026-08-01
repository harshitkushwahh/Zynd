import type { SecurityConfigItem } from "@/lib/admin-api";
import { LockKeyhole, ShieldAlert, SlidersHorizontal, Timer, type LucideIcon } from "lucide-react";

export type SecurityConfigFieldType = "number" | "select";

export type SecurityConfigFieldMeta = {
  label: string;
  description: string;
  type: SecurityConfigFieldType;
  inputHint?: string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
};

export type SecurityConfigGroup = {
  id: string;
  title: string;
  description: string;
  keys: string[];
};

export type SecurityConfigTabId = "lockout" | "risk" | "ops-thresholds" | "other";

export type SecurityConfigTab = {
  id: SecurityConfigTabId;
  slug?: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type SecurityConfigSubsection = {
  id: string;
  title: string;
  description: string;
  keys: string[];
};

export const SECURITY_CONFIG_TABS: SecurityConfigTab[] = [
  {
    id: "lockout",
    label: "Login lockout",
    description: "Failed sign-in limits, backoff delays, and IP blocking.",
    icon: LockKeyhole,
  },
  {
    id: "risk",
    slug: "risk",
    label: "Adaptive risk",
    description: "Risk score thresholds and enforcement during sign-in.",
    icon: ShieldAlert,
  },
  {
    id: "ops-thresholds",
    slug: "ops-thresholds",
    label: "Ops thresholds",
    description: "Mutual fund reconciliation windows and stuck pipeline counts.",
    icon: Timer,
  },
  {
    id: "other",
    slug: "other",
    label: "Other",
    description: "Additional platform security keys.",
    icon: SlidersHorizontal,
  },
];

export const SECURITY_CONFIG_GROUPS: SecurityConfigGroup[] = [
  {
    id: "lockout",
    title: "Login lockout",
    description: "Failed sign-in limits, backoff, and IP blocking thresholds.",
    keys: [
      "lockout.captcha_after_attempt",
      "lockout.max_attempts",
      "lockout.duration_minutes",
      "lockout.backoff_start_attempt",
      "lockout.backoff_base_seconds",
      "lockout.ip_block_threshold",
    ],
  },
  {
    id: "risk",
    title: "Adaptive risk",
    description: "Risk scoring thresholds and actions applied during sign-in.",
    keys: [
      "risk.medium_score",
      "risk.medium_action",
      "risk.high_score",
      "risk.high_action",
    ],
  },
];

export const SECURITY_CONFIG_SUBSECTIONS: Record<
  Exclude<SecurityConfigTabId, "other" | "ops-thresholds">,
  SecurityConfigSubsection[]
> = {
  lockout: [
    {
      id: "limits",
      title: "Account limits",
      description: "When captcha appears, accounts lock, and how long they stay locked.",
      keys: [
        "lockout.captcha_after_attempt",
        "lockout.max_attempts",
        "lockout.duration_minutes",
      ],
    },
    {
      id: "backoff",
      title: "Exponential backoff",
      description: "Slow down repeated failed sign-ins before a full lockout.",
      keys: ["lockout.backoff_start_attempt", "lockout.backoff_base_seconds"],
    },
    {
      id: "network",
      title: "IP protection",
      description: "Block abusive source IPs across accounts.",
      keys: ["lockout.ip_block_threshold"],
    },
  ],
  risk: [
    {
      id: "scores",
      title: "Risk thresholds",
      description: "Score cutoffs that classify a sign-in as medium or high risk.",
      keys: ["risk.medium_score", "risk.high_score"],
    },
    {
      id: "actions",
      title: "Enforcement actions",
      description: "What the platform does when each risk level is reached.",
      keys: ["risk.medium_action", "risk.high_action"],
    },
  ],
};

export const SECURITY_CONFIG_FIELD_META: Record<string, SecurityConfigFieldMeta> = {
  "lockout.captcha_after_attempt": {
    label: "Show captcha after",
    description: "How many failed sign-ins before users must complete a captcha.",
    type: "number",
    inputHint: "Number of failed attempts",
    min: 1,
    max: 50,
  },
  "lockout.max_attempts": {
    label: "Lock account after",
    description: "How many failed sign-ins before the account is temporarily locked.",
    type: "number",
    inputHint: "Number of failed attempts",
    min: 1,
    max: 100,
  },
  "lockout.duration_minutes": {
    label: "Lockout length",
    description: "How long a locked account stays locked before sign-in can be tried again.",
    type: "number",
    inputHint: "Minutes",
    min: 1,
    max: 1440,
  },
  "lockout.backoff_start_attempt": {
    label: "Slow down sign-in after",
    description: "From this failed attempt onward, each try waits longer than the last.",
    type: "number",
    inputHint: "Attempt number",
    min: 1,
    max: 100,
  },
  "lockout.backoff_base_seconds": {
    label: "Initial delay",
    description: "Starting wait time before sign-in is allowed again; it grows with each failure.",
    type: "number",
    inputHint: "Seconds",
    min: 1,
    max: 300,
  },
  "lockout.ip_block_threshold": {
    label: "Block IP after",
    description: "How many failed sign-ins from one IP (across accounts) before that IP is blocked.",
    type: "number",
    inputHint: "Number of failed attempts",
    min: 1,
    max: 1000,
  },
  "risk.medium_score": {
    label: "Medium risk threshold",
    description: "Sign-ins at this score or higher are treated as medium risk.",
    type: "number",
    inputHint: "Minimum score",
    min: 1,
    max: 99,
  },
  "risk.medium_action": {
    label: "When medium risk is reached",
    description: "What the platform should do for a medium-risk sign-in.",
    type: "select",
    options: [
      { value: "step_up_mfa", label: "Require MFA step-up" },
      { value: "block_login", label: "Block sign-in" },
    ],
  },
  "risk.high_score": {
    label: "High risk threshold",
    description: "Sign-ins at this score or higher are treated as high risk.",
    type: "number",
    inputHint: "Minimum score",
    min: 2,
    max: 100,
  },
  "risk.high_action": {
    label: "When high risk is reached",
    description: "What the platform should do for a high-risk sign-in.",
    type: "select",
    options: [
      { value: "block_login", label: "Block sign-in" },
      { value: "step_up_mfa", label: "Require MFA step-up" },
    ],
  },
};

const HIDDEN_SECURITY_CONFIG_PREFIXES = ["integrations."] as const;

export function isEditableSecurityConfigKey(key: string) {
  return !HIDDEN_SECURITY_CONFIG_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function groupSecurityConfigItems(items: SecurityConfigItem[]) {
  const editable = items.filter((item) => isEditableSecurityConfigKey(item.key));
  const byKey = new Map(editable.map((item) => [item.key, item]));

  const grouped = SECURITY_CONFIG_GROUPS.map((group) => ({
    ...group,
    items: group.keys
      .map((key) => byKey.get(key))
      .filter((item): item is SecurityConfigItem => Boolean(item)),
  })).filter((group) => group.items.length > 0);

  const knownKeys = new Set(SECURITY_CONFIG_GROUPS.flatMap((group) => group.keys));
  const other = editable.filter((item) => !knownKeys.has(item.key));

  return { grouped, other };
}

export function formatSecurityConfigValue(value: unknown) {
  if (value === true) return "true";
  if (value === false) return "false";
  if (value === null || value === undefined) return "";
  return String(value);
}

export function getSecurityConfigFieldMeta(key: string): SecurityConfigFieldMeta {
  return (
    SECURITY_CONFIG_FIELD_META[key] ?? {
      label: key.split(".").pop()?.replace(/_/g, " ") ?? key,
      description: "Adjust this platform security setting.",
      type: "number",
      min: 1,
      max: 1000,
    }
  );
}

export function getSecurityConfigNumberBoundsError(
  key: string,
  raw: string,
): string | null {
  const meta = getSecurityConfigFieldMeta(key);
  if (meta.type !== "number") return null;
  const trimmed = raw.trim();
  if (!trimmed) return "Enter a value.";
  if (!/^-?\d+$/.test(trimmed)) return "Enter a whole number.";
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return "Enter a valid number.";
  if (meta.min != null && value < meta.min) {
    return `Minimum allowed value is ${meta.min}.`;
  }
  if (meta.max != null && value > meta.max) {
    return `Maximum allowed value is ${meta.max}.`;
  }
  return null;
}

function formatSecurityConfigNumberDisplay(key: string, value: number) {
  switch (key) {
    case "lockout.captcha_after_attempt":
      return `After ${value} failed attempts`;
    case "lockout.max_attempts":
      return `After ${value} failed attempts`;
    case "lockout.duration_minutes":
      return value === 1 ? "1 minute" : `${value} minutes`;
    case "lockout.backoff_start_attempt":
      return `From attempt ${value}`;
    case "lockout.backoff_base_seconds":
      return value === 1 ? "1 second" : `${value} seconds`;
    case "lockout.ip_block_threshold":
      return `After ${value} failed attempts`;
    case "risk.medium_score":
    case "risk.high_score":
      return `Score of ${value} or higher`;
    default:
      return String(value);
  }
}

export function formatSecurityConfigDisplayValue(key: string, value: unknown) {
  const raw = formatSecurityConfigValue(value);
  if (!raw) return "";
  const meta = getSecurityConfigFieldMeta(key);
  if (meta.type === "select" && meta.options) {
    return meta.options.find((option) => option.value === raw)?.label ?? raw;
  }
  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && raw.trim() !== "") {
    return formatSecurityConfigNumberDisplay(key, numeric);
  }
  return raw;
}

export function formatSecurityConfigUpdatedAt(updatedAt?: string | null) {
  if (!updatedAt) return null;
  return new Date(updatedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function securityConfigTabHref(tab: SecurityConfigTab) {
  if (!tab.slug) return "/dashboard/security-config";
  return `/dashboard/security-config/${tab.slug}`;
}

export function resolveSecurityConfigTab(
  tabSlug: string | undefined,
  hasOtherItems: boolean,
): SecurityConfigTab {
  const visibleTabs = SECURITY_CONFIG_TABS.filter(
    (tab) => tab.id !== "other" || hasOtherItems,
  );
  if (!tabSlug) {
    return visibleTabs.find((tab) => tab.id === "lockout") ?? visibleTabs[0];
  }
  return (
    visibleTabs.find((tab) => tab.slug === tabSlug || tab.id === tabSlug) ??
    visibleTabs[0]
  );
}

export function getSecurityConfigItemsForTab(
  tabId: SecurityConfigTabId,
  items: SecurityConfigItem[],
) {
  if (tabId === "ops-thresholds") return [];
  const { grouped, other } = groupSecurityConfigItems(items);
  if (tabId === "other") return other;
  const group = grouped.find((entry) => entry.id === tabId);
  return group?.items ?? [];
}
