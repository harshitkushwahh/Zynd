"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  Ban,
  Gauge,
  KeyRound,
  ShieldCheck,
  Timer,
} from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminFormSkeleton } from "@/components/ui/admin-skeletons";
import { AdminInfoDialogTrigger } from "@/components/ui/admin-dialog-presets";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
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
  groupSecurityConfigItems,
  SECURITY_CONFIG_SUBSECTIONS,
  type SecurityConfigTabId,
} from "@/lib/admin-security-config-meta";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";


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
  const infoDetails = meta.inputHint ? [meta.inputHint] : undefined;

  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-compact font-semibold text-foreground">{meta.label}</h4>
            <AdminInfoDialogTrigger
              title={meta.label}
              description={meta.description}
              details={infoDetails}
            />
            {hasChanges ? (
              <Badge variant="secondary" className="text-micro uppercase tracking-wide">
                Modified
              </Badge>
            ) : null}
          </div>
          <p className="text-caption text-foreground">
            <span className="text-muted-foreground">Currently set to </span>
            <span className="font-medium">{currentDisplay || "not configured"}</span>
            {updatedLabel ? (
              <span className="text-muted-foreground">{` · Last updated ${updatedLabel}`}</span>
            ) : null}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-72">
          <div className="space-y-1.5">
            <Label htmlFor={`security-${item.key}`} className="sr-only">
              {meta.label}
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
              <Input
                id={`security-${item.key}`}
                type="number"
                inputMode="numeric"
                value={draftValue}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder={meta.inputHint ?? "Enter a value"}
              />
            )}
          </div>

          <Button
            size="sm"
            variant={hasChanges ? "default" : "outline"}
            className="w-full sm:w-auto sm:self-end"
            disabled={submitting || !hasChanges}
            onClick={onSubmit}
          >
            {submitting ? "Submitting…" : "Request update"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function SecurityConfigSubsectionBlock({
  title,
  description,
  items,
  draftValues,
  submittingKey,
  onDraftChange,
  onSubmit,
}: {
  title: string;
  description: string;
  items: SecurityConfigItem[];
  draftValues: Record<string, string>;
  submittingKey: string | null;
  onDraftChange: (key: string, value: string) => void;
  onSubmit: (item: SecurityConfigItem) => void;
}) {
  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-compact font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-caption text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-3">
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
    </section>
  );
}

function LockoutTabSummary({ items }: { items: SecurityConfigItem[] }) {
  const captcha = findConfigItem(items, "lockout.captcha_after_attempt");
  const maxAttempts = findConfigItem(items, "lockout.max_attempts");
  const duration = findConfigItem(items, "lockout.duration_minutes");
  const ipBlock = findConfigItem(items, "lockout.ip_block_threshold");
  const captchaMeta = getSecurityConfigFieldMeta("lockout.captcha_after_attempt");
  const maxAttemptsMeta = getSecurityConfigFieldMeta("lockout.max_attempts");
  const durationMeta = getSecurityConfigFieldMeta("lockout.duration_minutes");
  const ipBlockMeta = getSecurityConfigFieldMeta("lockout.ip_block_threshold");

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AdminMetricCard
        label="Captcha threshold"
        value={formatSecurityConfigDisplayValue(
          "lockout.captcha_after_attempt",
          captcha?.value,
        ) || "—"}
        infoDescription={captchaMeta.description}
        icon={KeyRound}
        tone="info"
      />
      <AdminMetricCard
        label="Account lockout"
        value={formatSecurityConfigDisplayValue("lockout.max_attempts", maxAttempts?.value) || "—"}
        infoDescription={maxAttemptsMeta.description}
        icon={Ban}
        tone="warning"
      />
      <AdminMetricCard
        label="Lockout duration"
        value={formatSecurityConfigDisplayValue("lockout.duration_minutes", duration?.value) || "—"}
        infoDescription={durationMeta.description}
        icon={Timer}
        tone="default"
      />
      <AdminMetricCard
        label="IP block threshold"
        value={formatSecurityConfigDisplayValue(
          "lockout.ip_block_threshold",
          ipBlock?.value,
        ) || "—"}
        infoDescription={ipBlockMeta.description}
        icon={ShieldCheck}
        tone="muted"
      />
    </div>
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
    <div className="grid gap-3 sm:grid-cols-2">
        <AdminMetricCard
          label="Medium risk"
          value={formatSecurityConfigDisplayValue("risk.medium_score", mediumScore?.value) || "—"}
          infoDescription={mediumScoreMeta.description}
          infoDetails={mediumActionDisplay ? [`Enforcement: ${mediumActionDisplay}`] : undefined}
          icon={Gauge}
          tone="info"
        />
        <AdminMetricCard
          label="High risk"
          value={formatSecurityConfigDisplayValue("risk.high_score", highScore?.value) || "—"}
          infoDescription={highScoreMeta.description}
          infoDetails={highActionDisplay ? [`Enforcement: ${highActionDisplay}`] : undefined}
          icon={ShieldCheck}
          tone="warning"
        />
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
  const itemsByKey = useMemo(
    () => new Map(tabItems.map((item) => [item.key, item])),
    [tabItems],
  );

  if (!tabItems.length) {
    return (
      <p className="text-caption text-muted-foreground">No settings available in this section.</p>
    );
  }

  if (tabId === "other") {
    return (
      <div className="space-y-3">
        {tabItems.map((item) => (
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

  const subsections = SECURITY_CONFIG_SUBSECTIONS[tabId];

  return (
    <div className="space-y-6">
      {tabId === "lockout" ? <LockoutTabSummary items={tabItems} /> : null}
      {tabId === "risk" ? <RiskTabSummary items={tabItems} /> : null}

      {subsections.map((subsection) => {
        const subsectionItems = subsection.keys
          .map((key) => itemsByKey.get(key))
          .filter((item): item is SecurityConfigItem => Boolean(item));

        return (
          <SecurityConfigSubsectionBlock
            key={subsection.id}
            title={subsection.title}
            description={subsection.description}
            items={subsectionItems}
            draftValues={draftValues}
            submittingKey={submittingKey}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
          />
        );
      })}
    </div>
  );
}

type AdminSecurityConfigSettingsPanelProps = {
  activeTab: SecurityConfigTabId;
  onHasOtherItemsChange?: (hasOtherItems: boolean) => void;
  onRiskItemsChange?: (items: SecurityConfigItem[]) => void;
};

export function AdminSecurityConfigSettingsPanel({
  activeTab,
  onHasOtherItemsChange,
  onRiskItemsChange,
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

  useEffect(() => {
    onRiskItemsChange?.(getSecurityConfigItemsForTab("risk", items));
  }, [items, onRiskItemsChange]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSubmit = async (item: SecurityConfigItem) => {
    const raw = draftValues[item.key] ?? "";
    const meta = getSecurityConfigFieldMeta(item.key);
    let parsed: string | number | boolean = raw;

    if (meta.type === "select") {
      parsed = raw;
    } else if (raw === "true" || raw === "false") {
      parsed = raw === "true";
    } else if (raw.trim() !== "" && !Number.isNaN(Number(raw))) {
      parsed = Number(raw);
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

  if (loading) {
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
