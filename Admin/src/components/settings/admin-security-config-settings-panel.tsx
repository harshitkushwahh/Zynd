"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  Ban,
  Clock3,
  Gauge,
  GlobeLock,
  Hourglass,
  Info,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  type LucideIcon,
} from "lucide-react";

import { RiskEnforcementLadderCard } from "@/components/settings/admin-risk-enforcement-ladder";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminFormSkeleton } from "@/components/ui/admin-skeletons";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  fetchSecurityConfig,
  requestSecurityConfigUpdate,
  type SecurityConfigItem,
} from "@/lib/admin-api";
import {
  formatSecurityConfigDisplayValue,
  formatSecurityConfigUpdatedAt,
  formatSecurityConfigValue,
  getSecurityConfigFieldMeta,
  getSecurityConfigItemsForTab,
  getSecurityConfigNumberBoundsError,
  groupSecurityConfigItems,
  SECURITY_CONFIG_SUBSECTIONS,
  type SecurityConfigTabId,
} from "@/lib/admin-security-config-meta";
import { cn } from "@/lib/utils";

type SecurityConfigFieldTone = "info" | "warning" | "success" | "muted" | "danger";

const SECURITY_CONFIG_FIELD_META_UI: Record<
  string,
  { icon: LucideIcon; tone: SecurityConfigFieldTone }
> = {
  "lockout.captcha_after_attempt": { icon: KeyRound, tone: "info" },
  "lockout.max_attempts": { icon: Ban, tone: "warning" },
  "lockout.duration_minutes": { icon: Timer, tone: "muted" },
  "lockout.backoff_start_attempt": { icon: Hourglass, tone: "info" },
  "lockout.backoff_base_seconds": { icon: Clock3, tone: "success" },
  "lockout.ip_block_threshold": { icon: GlobeLock, tone: "danger" },
  "risk.medium_score": { icon: Gauge, tone: "info" },
  "risk.high_score": { icon: ShieldAlert, tone: "warning" },
  "risk.medium_action": { icon: ShieldCheck, tone: "info" },
  "risk.high_action": { icon: ShieldCheck, tone: "danger" },
};

const SECURITY_CONFIG_FIELD_ICON_TONE: Record<SecurityConfigFieldTone, string> = {
  info: "bg-primary/12 text-primary",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/12 text-success",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive/12 text-destructive",
};

function findConfigItem(items: SecurityConfigItem[], key: string) {
  return items.find((item) => item.key === key) ?? null;
}

function SecurityConfigFieldCard({
  item,
  draftValue,
  submitting,
  onDraftChange,
  onSubmit,
}: {
  item: SecurityConfigItem;
  draftValue: string;
  submitting: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const meta = getSecurityConfigFieldMeta(item.key);
  const currentValue = formatSecurityConfigValue(item.value);
  const currentDisplay = formatSecurityConfigDisplayValue(item.key, item.value);
  const updatedLabel = formatSecurityConfigUpdatedAt(item.updated_at);
  const hasChanges = draftValue !== currentValue;
  const boundsError =
    meta.type === "number" ? getSecurityConfigNumberBoundsError(item.key, draftValue) : null;
  const fieldUi = SECURITY_CONFIG_FIELD_META_UI[item.key] ?? {
    icon: SlidersHorizontal,
    tone: "muted" as const,
  };
  const Icon = fieldUi.icon;
  const rangeHint =
    meta.type === "number" && meta.min != null && meta.max != null
      ? `Allowed range: ${meta.min}–${meta.max}`
      : null;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-[0_1px_0_color-mix(in_srgb,var(--border)_55%,transparent)] transition-colors",
        hasChanges && "border-primary/45 bg-primary/[0.03] shadow-none",
      )}
    >
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              SECURITY_CONFIG_FIELD_ICON_TONE[fieldUi.tone],
            )}
          >
            <Icon className="size-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className="text-compact font-semibold text-foreground">{meta.label}</h4>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`About ${meta.label}`}
                    >
                      <Info className="size-3.5" />
                    </Button>
                  }
                />
                <TooltipContent side="top" className="max-w-64 text-pretty leading-relaxed">
                  <span className="block">{meta.description}</span>
                  {rangeHint ? <span className="mt-1 block opacity-90">{rangeHint}</span> : null}
                </TooltipContent>
              </Tooltip>
              {hasChanges ? (
                <Badge variant="secondary" className="text-micro uppercase tracking-wide">
                  Modified
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius-control)] border border-border/70 bg-gradient-to-b from-muted/35 to-muted/10 px-3.5 py-3.5">
          <p className="font-sans text-h4 font-semibold tabular-nums tracking-tight text-foreground">
            {currentDisplay || "Not configured"}
          </p>
          {updatedLabel ? (
            <p className="mt-1.5 text-micro text-muted-foreground">Updated {updatedLabel}</p>
          ) : null}
        </div>

        <div className="mt-auto space-y-2.5">
          <Label htmlFor={`security-${item.key}`} className="text-caption text-muted-foreground">
            New value
          </Label>
          {meta.type === "select" && meta.options ? (
            <Select
              value={draftValue}
              onValueChange={(value) => onDraftChange(value ?? draftValue)}
            >
              <SelectTrigger id={`security-${item.key}`} className="w-full">
                <SelectValue placeholder="Choose an action" />
              </SelectTrigger>
              <SelectContent>
                {meta.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Input
                id={`security-${item.key}`}
                type="number"
                inputMode="numeric"
                min={meta.min}
                max={meta.max}
                step={1}
                value={draftValue}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder={meta.inputHint ?? "Enter a value"}
                aria-invalid={Boolean(boundsError && hasChanges)}
              />
              {boundsError && hasChanges ? (
                <p className="text-caption text-destructive">{boundsError}</p>
              ) : null}
            </>
          )}
          <Button
            size="sm"
            variant={hasChanges ? "default" : "outline"}
            className="w-full"
            disabled={submitting || !hasChanges || Boolean(boundsError)}
            onClick={onSubmit}
          >
            {submitting ? "Submitting…" : "Request update"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function SecurityConfigFieldGrid({
  items,
  draftValues,
  submittingKey,
  onDraftChange,
  onSubmit,
}: {
  items: SecurityConfigItem[];
  draftValues: Record<string, string>;
  submittingKey: string | null;
  onDraftChange: (key: string, value: string) => void;
  onSubmit: (item: SecurityConfigItem) => void;
}) {
  if (!items.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <SecurityConfigFieldCard
          key={item.key}
          item={item}
          draftValue={draftValues[item.key] ?? ""}
          submitting={submittingKey === item.key}
          onDraftChange={(value) => onDraftChange(item.key, value)}
          onSubmit={() => onSubmit(item)}
        />
      ))}
    </div>
  );
}

function LockoutTabSummary({ items }: { items: SecurityConfigItem[] }) {
  const captcha = findConfigItem(items, "lockout.captcha_after_attempt");
  const maxAttempts = findConfigItem(items, "lockout.max_attempts");
  const duration = findConfigItem(items, "lockout.duration_minutes");
  const ipBlock = findConfigItem(items, "lockout.ip_block_threshold");

  return (
    <AdminMetricCardsGrid columns="four">
      <AdminMetricCard
        label="Captcha threshold"
        value={formatSecurityConfigDisplayValue(
          "lockout.captcha_after_attempt",
          captcha?.value,
        ) || "—"}
        infoDescription="Failed attempts before captcha"
        icon={KeyRound}
        tone="info"
        accent
      />
      <AdminMetricCard
        label="Account lockout"
        value={formatSecurityConfigDisplayValue("lockout.max_attempts", maxAttempts?.value) || "—"}
        infoDescription="Failed attempts before lock"
        icon={Ban}
        tone="warning"
      />
      <AdminMetricCard
        label="Lockout duration"
        value={formatSecurityConfigDisplayValue("lockout.duration_minutes", duration?.value) || "—"}
        infoDescription="Time before retry is allowed"
        icon={Timer}
        tone="default"
      />
      <AdminMetricCard
        label="IP block threshold"
        value={formatSecurityConfigDisplayValue(
          "lockout.ip_block_threshold",
          ipBlock?.value,
        ) || "—"}
        infoDescription="Failed attempts from one IP"
        icon={ShieldCheck}
        tone="muted"
      />
    </AdminMetricCardsGrid>
  );
}

function RiskTabSummary({ items }: { items: SecurityConfigItem[] }) {
  const mediumScore = findConfigItem(items, "risk.medium_score");
  const highScore = findConfigItem(items, "risk.high_score");
  const mediumAction = findConfigItem(items, "risk.medium_action");
  const highAction = findConfigItem(items, "risk.high_action");
  const mediumScoreMeta = getSecurityConfigFieldMeta("risk.medium_score");
  const highScoreMeta = getSecurityConfigFieldMeta("risk.high_score");
  const mediumActionDisplay = mediumAction
    ? formatSecurityConfigDisplayValue("risk.medium_action", mediumAction.value)
    : null;
  const highActionDisplay = highAction
    ? formatSecurityConfigDisplayValue("risk.high_action", highAction.value)
    : null;

  return (
    <div className="admin-security-risk-summary grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.85fr)] lg:items-stretch">
      <div className="grid h-full gap-3 sm:grid-cols-2">
        <AdminMetricCard
          className="admin-security-risk-summary__metric"
          label="Medium risk"
          value={formatSecurityConfigDisplayValue("risk.medium_score", mediumScore?.value) || "—"}
          infoDescription={
            mediumActionDisplay
              ? `Enforcement: ${mediumActionDisplay}`
              : mediumScoreMeta.description
          }
          icon={Gauge}
          tone="info"
          accent
        />
        <AdminMetricCard
          className="admin-security-risk-summary__metric"
          label="High risk"
          value={formatSecurityConfigDisplayValue("risk.high_score", highScore?.value) || "—"}
          infoDescription={
            highActionDisplay ? `Enforcement: ${highActionDisplay}` : highScoreMeta.description
          }
          icon={ShieldCheck}
          tone="warning"
        />
      </div>

      <RiskEnforcementLadderCard items={items} />
    </div>
  );
}

function SecurityConfigTabContent({
  tabId,
  items,
  draftValues,
  submittingKey,
  onDraftChange,
  onSubmit,
}: {
  tabId: SecurityConfigTabId;
  items: SecurityConfigItem[];
  draftValues: Record<string, string>;
  submittingKey: string | null;
  onDraftChange: (key: string, value: string) => void;
  onSubmit: (item: SecurityConfigItem) => void;
}) {
  const tabItems = useMemo(() => getSecurityConfigItemsForTab(tabId, items), [items, tabId]);

  const orderedFieldItems = useMemo(() => {
    if (tabId === "other" || tabId === "ops-thresholds") return tabItems;
    const itemsByKey = new Map(tabItems.map((item) => [item.key, item]));
    return SECURITY_CONFIG_SUBSECTIONS[tabId]
      .flatMap((subsection) => subsection.keys)
      .map((key) => itemsByKey.get(key))
      .filter((item): item is SecurityConfigItem => Boolean(item));
  }, [tabId, tabItems]);

  if (!tabItems.length) {
    return (
      <p className="text-caption text-muted-foreground">No settings available in this section.</p>
    );
  }

  return (
    <div className="space-y-5">
      {tabId === "lockout" ? <LockoutTabSummary items={tabItems} /> : null}
      {tabId === "risk" ? <RiskTabSummary items={tabItems} /> : null}

      <SecurityConfigFieldGrid
        items={orderedFieldItems}
        draftValues={draftValues}
        submittingKey={submittingKey}
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
      />
    </div>
  );
}

type AdminSecurityConfigSettingsPanelProps = {
  activeTab: Exclude<SecurityConfigTabId, "ops-thresholds">;
  onHasOtherItemsChange?: (hasOtherItems: boolean) => void;
};

export function AdminSecurityConfigSettingsPanel({
  activeTab,
  onHasOtherItemsChange,
}: AdminSecurityConfigSettingsPanelProps) {
  const [items, setItems] = useState<SecurityConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const { other } = useMemo(() => groupSecurityConfigItems(items), [items]);

  useEffect(() => {
    onHasOtherItemsChange?.(other.length > 0);
  }, [onHasOtherItemsChange, other.length]);

  const loadConfig = useCallback(async () => {
    if (items.length === 0) setLoading(true);
    setError("");
    try {
      const result = await fetchSecurityConfig();
      setItems(result);
      setDraftValues(
        Object.fromEntries(
          result.map((item) => [item.key, formatSecurityConfigValue(item.value)]),
        ),
      );
    } catch (err) {
      setItems([]);
      setError(getErrorMessage(err, "Could not load security configuration."));
    } finally {
      setLoading(false);
    }
  }, [items.length]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSubmit = async (item: SecurityConfigItem) => {
    const raw = draftValues[item.key] ?? "";
    const meta = getSecurityConfigFieldMeta(item.key);
    let parsed: string | number | boolean = raw;

    if (meta.type === "select") {
      parsed = raw;
    } else {
      const boundsError = getSecurityConfigNumberBoundsError(item.key, raw);
      if (boundsError) {
        setError(boundsError);
        return;
      }
      parsed = Number(raw.trim());

      const mediumDraft = Number(
        draftValues["risk.medium_score"] ??
          formatSecurityConfigValue(findConfigItem(items, "risk.medium_score")?.value),
      );
      const highDraft = Number(
        draftValues["risk.high_score"] ??
          formatSecurityConfigValue(findConfigItem(items, "risk.high_score")?.value),
      );
      if (item.key === "risk.medium_score" && Number.isFinite(highDraft) && parsed >= highDraft) {
        setError("Medium risk score must be lower than high risk score.");
        return;
      }
      if (item.key === "risk.high_score" && Number.isFinite(mediumDraft) && parsed <= mediumDraft) {
        setError("High risk score must be higher than medium risk score.");
        return;
      }
    }

    setSubmittingKey(item.key);
    setError("");
    setMessage("");
    try {
      const result = await requestSecurityConfigUpdate({
        key: item.key,
        value: parsed,
        reason: `Update ${item.key} from security console`,
      });
      setMessage(result.message);
    } catch (err) {
      setError(getErrorMessage(err, "Could not submit configuration update."));
    } finally {
      setSubmittingKey(null);
    }
  };

  if (loading && items.length === 0) {
    return <AdminFormSkeleton rows={6} />;
  }

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <div className={cn(activeTab === "other" && other.length === 0 && "hidden")}>
        <SecurityConfigTabContent
          tabId={activeTab}
          items={items}
          draftValues={draftValues}
          submittingKey={submittingKey}
          onDraftChange={(key, value) =>
            setDraftValues((current) => ({ ...current, [key]: value }))
          }
          onSubmit={(item) => void handleSubmit(item)}
        />
      </div>
    </div>
  );
}
