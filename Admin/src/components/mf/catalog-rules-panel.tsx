"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  applyMfCatalogRules,
  createMfCatalogRule,
  fetchMfCatalogRules,
  previewMfCatalogRules,
  updateMfCatalogRule,
  type MfCatalogRule,
} from "@/lib/mf-admin-api";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

const DEFAULT_CONDITIONS = '{\n  "amc_empanelled": true,\n  "fp_purchasable": true,\n  "lifecycle_status": "DRAFT"\n}';
const DEFAULT_ACTIONS = '{\n  "set_lifecycle_status": "ACTIVE"\n}';

export function CatalogRulesPanel({
  canManageRules,
  canPublish,
}: {
  canManageRules: boolean;
  canPublish: boolean;
}) {
  const [rules, setRules] = useState<MfCatalogRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ affected_count: number; items: Array<Record<string, unknown>> } | null>(null);
  const [name, setName] = useState("");
  const [conditionsJson, setConditionsJson] = useState(DEFAULT_CONDITIONS);
  const [actionsJson, setActionsJson] = useState(DEFAULT_ACTIONS);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRules(await fetchMfCatalogRules());
    } catch (err) {
      setError(getErrorMessage(err, "Could not load catalog rules."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const handleCreate = async () => {
    if (!canManageRules) return;
    setError("");
    setMessage("");
    try {
      const conditions = JSON.parse(conditionsJson) as Record<string, unknown>;
      const actions = JSON.parse(actionsJson) as Record<string, unknown>;
      await createMfCatalogRule({
        name: name || "New catalog rule",
        conditions,
        actions,
        enabled: false,
      });
      setName("");
      setMessage("Rule created.");
      await loadRules();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create rule."));
    }
  };

  const handlePreview = async (ruleIds?: number[]) => {
    setError("");
    setMessage("");
    try {
      const result = await previewMfCatalogRules(ruleIds);
      setPreview(result);
      setMessage(`Preview: ${result.affected_count} fund(s) would change.`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not preview rules."));
    }
  };

  const handleApply = async () => {
    if (!canPublish) return;
    setError("");
    setMessage("");
    try {
      const result = await applyMfCatalogRules({ dry_run: false });
      setPreview(result);
      setMessage(
        result.pending_action_id
          ? `Submitted for maker-checker approval (${result.pending_action_id}).`
          : `Applied ${result.affected_count} change(s).`,
      );
      await loadRules();
    } catch (err) {
      setError(getErrorMessage(err, "Could not apply rules."));
    }
  };

  const toggleRule = async (rule: MfCatalogRule) => {
    if (!canManageRules) return;
    await updateMfCatalogRule(rule.id, { enabled: !rule.enabled });
    await loadRules();
  };

  return (
    <div className="space-y-6">
      {error ? <p className="text-compact text-destructive">{error}</p> : null}
      {message ? <p className="text-compact text-success">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Catalog rules</CardTitle>
          <CardDescription>
            JSON conditions and actions. Phase 8 overrides (FORCE_HIDE, kill switch) always win.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-compact text-muted-foreground">Loading rules…</p> : null}
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-[var(--radius-card)] border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-caption text-muted-foreground">
                    Priority {rule.priority} · {rule.enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void handlePreview([rule.id])}>
                    Preview
                  </Button>
                  {canManageRules ? (
                    <Button size="sm" variant="outline" onClick={() => void toggleRule(rule)}>
                      {rule.enabled ? "Disable" : "Enable"}
                    </Button>
                  ) : null}
                </div>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-[var(--radius-control)] bg-muted p-3 text-caption">
                {JSON.stringify({ conditions: rule.conditions, actions: rule.actions }, null, 2)}
              </pre>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void handlePreview()}>
              Preview all enabled
            </Button>
            {canPublish ? (
              <Button onClick={() => void handleApply()}>Apply enabled rules</Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {canManageRules ? (
        <Card>
          <CardHeader>
            <CardTitle>Create rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="block space-y-1 text-compact">
              <span className="text-muted-foreground">Conditions (JSON)</span>
              <textarea
                className="min-h-[120px] w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 font-mono text-caption"
                value={conditionsJson}
                onChange={(e) => setConditionsJson(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-compact">
              <span className="text-muted-foreground">Actions (JSON)</span>
              <textarea
                className="min-h-[120px] w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 font-mono text-caption"
                value={actionsJson}
                onChange={(e) => setActionsJson(e.target.value)}
              />
            </label>
            <Button size="sm" onClick={() => void handleCreate()}>
              Create rule
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview results</CardTitle>
            <CardDescription>{preview.affected_count} affected fund(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-[var(--radius-control)] bg-muted p-3 text-caption">
              {JSON.stringify(preview.items.slice(0, 50), null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
