"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  AlertTriangle,
  GitBranch,
  Layers3,
  Play,
  Plus,
  Search,
  Sparkles,
  Workflow,
} from "lucide-react";

import { MfStatusChip } from "@/components/mf/mf-status-chip";
import {
  AdminDialogFooterActions,
  AdminFormDialog,
  AdminInfoDialog,
} from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  applyMfCatalogRules,
  createMfCatalogRule,
  fetchMfCatalogRules,
  previewMfCatalogRules,
  updateMfCatalogRule,
  type MfCatalogRule,
} from "@/lib/mf-admin-api";
import { cn } from "@/lib/utils";


const DEFAULT_CONDITIONS = '{\n  "amc_empanelled": true,\n  "fp_purchasable": true,\n  "lifecycle_status": "DRAFT"\n}';
const DEFAULT_ACTIONS = '{\n  "set_lifecycle_status": "ACTIVE"\n}';

const RULE_WORKFLOW_STEPS = [
  {
    title: "Define conditions",
    description: "Match funds by lifecycle, AMC status, or purchasability.",
    icon: Search,
  },
  {
    title: "Set actions",
    description: "Choose what changes when a fund matches the rule.",
    icon: Workflow,
  },
  {
    title: "Preview & apply",
    description: "Dry-run impact, enable the rule, then apply safely.",
    icon: Play,
  },
] as const;

function RulesInfoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AdminInfoDialog
      open={open}
      onClose={onClose}
      title="Catalog rules"
      description="Automate fund lifecycle updates in bulk with JSON conditions and actions."
      icon={GitBranch}
      iconTone="info"
      size="lg"
    >
      <div className="flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GitBranch className="size-6" strokeWidth={2} />
        </div>
        <h3 className="mt-4 text-compact font-semibold text-foreground">No catalog rules yet</h3>
        <p className="mt-2 max-w-md text-caption text-muted-foreground">
          Rules automate fund lifecycle updates in bulk. Start with a disabled rule, preview the impact,
          then enable and apply when ready.
        </p>

        <div className="mt-6 grid w-full gap-3 text-left sm:grid-cols-3">
          {RULE_WORKFLOW_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="rounded-control border border-border bg-muted/10 p-4"
              >
                <div className="flex size-8 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                  <Icon className="size-4" />
                </div>
                <p className="mt-3 font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-caption text-muted-foreground">{step.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 w-full rounded-control border border-border bg-muted/10 p-4 text-left">
          <div className="flex items-center gap-2 text-caption font-medium text-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Starter template
          </div>
          <pre className="mt-3 overflow-x-auto rounded-control bg-muted/40 p-3 font-mono text-caption text-muted-foreground">
            {`conditions: ${DEFAULT_CONDITIONS.replaceAll("\n", " ")}\nactions: ${DEFAULT_ACTIONS.replaceAll("\n", " ")}`}
          </pre>
        </div>
      </div>
    </AdminInfoDialog>
  );
}

function RuleCreatorDialog({
  open,
  name,
  conditionsJson,
  actionsJson,
  creating,
  onNameChange,
  onConditionsChange,
  onActionsChange,
  onCreate,
  onClose,
}: {
  open: boolean;
  name: string;
  conditionsJson: string;
  actionsJson: string;
  creating?: boolean;
  onNameChange: (value: string) => void;
  onConditionsChange: (value: string) => void;
  onActionsChange: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <AdminFormDialog
      open={open}
      onClose={onClose}
      title="Create rule"
      description="New rules start disabled. Preview before enabling and applying."
      icon={Plus}
      iconTone="info"
      size="detail"
      footer={
        <AdminDialogFooterActions
          cancelLabel="Cancel"
          confirmLabel="Create rule"
          confirmIcon={Plus}
          loading={creating}
          loadingLabel="Creating…"
          onCancel={onClose}
          onConfirm={onCreate}
        />
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mf-rule-name">Rule name</Label>
          <Input
            id="mf-rule-name"
            placeholder="Promote empanelled draft funds"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mf-rule-conditions">Conditions (JSON)</Label>
            <textarea
              id="mf-rule-conditions"
              className="min-h-field-xl w-full rounded-control border border-input bg-transparent px-3 py-2 font-mono text-caption"
              value={conditionsJson}
              onChange={(event) => onConditionsChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mf-rule-actions">Actions (JSON)</Label>
            <textarea
              id="mf-rule-actions"
              className="min-h-field-xl w-full rounded-control border border-input bg-transparent px-3 py-2 font-mono text-caption"
              value={actionsJson}
              onChange={(event) => onActionsChange(event.target.value)}
            />
          </div>
        </div>
      </div>
    </AdminFormDialog>
  );
}

export type CatalogRulesPanelHandle = {
  openInfoDialog: () => void;
  openCreateDialog: () => void;
  canOpenInfo: () => boolean;
};

export const CatalogRulesPanel = forwardRef<
  CatalogRulesPanelHandle,
  {
    canManageRules: boolean;
    canPublish: boolean;
    embedded?: boolean;
  }
>(function CatalogRulesPanel({ canManageRules, canPublish, embedded = false }, ref) {
  const [rules, setRules] = useState<MfCatalogRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ affected_count: number; items: Array<Record<string, unknown>> } | null>(null);
  const [name, setName] = useState("");
  const [conditionsJson, setConditionsJson] = useState(DEFAULT_CONDITIONS);
  const [actionsJson, setActionsJson] = useState(DEFAULT_ACTIONS);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      openInfoDialog: () => setInfoDialogOpen(true),
      openCreateDialog: () => setCreateDialogOpen(true),
      canOpenInfo: () => !loading,
    }),
    [loading],
  );

  const closeCreateDialog = () => {
    if (creating) return;
    setCreateDialogOpen(false);
  };

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
    setCreating(true);
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
      setConditionsJson(DEFAULT_CONDITIONS);
      setActionsJson(DEFAULT_ACTIONS);
      setCreateDialogOpen(false);
      setMessage("Rule created.");
      await loadRules();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create rule."));
    } finally {
      setCreating(false);
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

  const enabledCount = rules.filter((rule) => rule.enabled).length;
  const hasEnabledRules = enabledCount > 0;

  const content = (
    <div className="space-y-5">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <AdminMetricCardsGrid columns="three">
        <AdminMetricCard
          label="Total rules"
          value={rules.length.toLocaleString()}
          icon={Layers3}
          loading={loading}
        />
        <AdminMetricCard
          label="Enabled"
          value={enabledCount.toLocaleString()}
          icon={Play}
          tone="success"
          loading={loading}
        />
        <AdminMetricCard
          label="Disabled"
          value={(rules.length - enabledCount).toLocaleString()}
          icon={GitBranch}
          tone="muted"
          loading={loading}
        />
      </AdminMetricCardsGrid>

      <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-warning/20 bg-warning/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-caption text-muted-foreground">
          Phase 8 overrides such as <span className="font-medium text-foreground">FORCE_HIDE</span>{" "}
          and AMC kill switches always win over catalog rules.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasEnabledRules}
          onClick={() => void handlePreview()}
        >
          <Search className="size-3.5" />
          Preview enabled
        </Button>
        {canPublish ? (
          <Button size="sm" disabled={!hasEnabledRules} onClick={() => void handleApply()}>
            <Play className="size-3.5" />
            Apply enabled
          </Button>
        ) : null}
        {canManageRules && !embedded ? (
          <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-3.5" />
            New rule
          </Button>
        ) : null}
      </div>

      <AdminDataTable minWidth="3xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
            <AdminTableHeadCell>Rule</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Priority</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Definition</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={5} />
          ) : rules.length === 0 ? (
            <AdminTableStateRow colSpan={5}>
              No catalog rules configured. Create a rule to get started.
            </AdminTableStateRow>
          ) : (
            rules.map((rule) => (
              <AdminTableRow key={rule.id}>
                <AdminTableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => void handlePreview([rule.id])}>
                      Preview
                    </Button>
                    {canManageRules ? (
                      <Button size="sm" variant="outline" onClick={() => void toggleRule(rule)}>
                        {rule.enabled ? "Disable" : "Enable"}
                      </Button>
                    ) : null}
                  </div>
                </AdminTableCell>
                <AdminTableCell className="font-medium text-foreground">{rule.name}</AdminTableCell>
                <AdminTableCell className="text-right tabular-nums">{rule.priority}</AdminTableCell>
                <AdminTableCell>
                  <MfStatusChip
                    label={rule.enabled ? "Enabled" : "Disabled"}
                    tone={rule.enabled ? "success" : "neutral"}
                    showIcon={false}
                  />
                </AdminTableCell>
                <AdminTableCell>
                  <pre className="max-h-28 max-w-md overflow-auto rounded-[var(--radius-control)] bg-muted/40 p-2 font-mono text-caption">
                    {JSON.stringify({ conditions: rule.conditions, actions: rule.actions }, null, 2)}
                  </pre>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <RuleCreatorDialog
        open={createDialogOpen}
        name={name}
        conditionsJson={conditionsJson}
        actionsJson={actionsJson}
        creating={creating}
        onNameChange={setName}
        onConditionsChange={setConditionsJson}
        onActionsChange={setActionsJson}
        onCreate={() => void handleCreate()}
        onClose={closeCreateDialog}
      />

      <RulesInfoDialog open={infoDialogOpen} onClose={() => setInfoDialogOpen(false)} />

      {preview ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium text-foreground">Preview results</h3>
              <p className="mt-1 text-caption text-muted-foreground">
                {preview.affected_count.toLocaleString()} affected fund(s)
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
              Dismiss
            </Button>
          </div>
          <pre className="mt-3 max-h-scroll-lg overflow-auto rounded-[var(--radius-control)] bg-muted/40 p-3 font-mono text-caption">
            {JSON.stringify(preview.items.slice(0, 50), null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );

  if (embedded) return content;

  return (
    <Card className={cn(!embedded && "mt-0")}>
      <CardHeader>
        <CardTitle>Catalog rules</CardTitle>
        <CardDescription>
          JSON conditions and actions. Phase 8 overrides (FORCE_HIDE, kill switch) always win.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
});
