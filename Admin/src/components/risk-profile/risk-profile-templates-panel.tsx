"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus, Sparkles } from "lucide-react";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import {
  RISK_TEMPLATE_DETAIL_ICON,
  RiskTemplateDetailView,
} from "@/components/risk-profile/risk-profile-detail-views";
import {
  AdminDeleteDialog,
  AdminDetailDialog,
  AdminDialogFooterActions,
  AdminFormDialog,
} from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableRows,
  paginateItems,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/errors";
import {
  autoSelectRiskTemplate,
  createRiskTemplate,
  fetchRiskCategories,
  fetchRiskTemplates,
  updateRiskTemplate,
  type RiskCategory,
  type RiskTemplate,
} from "@/lib/risk-profile-admin-api";

type RuleDraft = { category_id: string; question_count: string };

const TABLE_COLUMN_COUNT = 5;

function templateModeBadge(mode: RiskTemplate["selection_mode"]) {
  return (
    <StatusBadge variant={mode === "auto" ? "success" : "info"} showIcon={false}>
      {mode === "auto" ? "Auto" : "Manual"}
    </StatusBadge>
  );
}

function TemplateRulesEditor({
  categories,
  rules,
  onChange,
}: {
  categories: RiskCategory[];
  rules: RuleDraft[];
  onChange: (rules: RuleDraft[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Category rules</Label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onChange([...rules, { category_id: "", question_count: "1" }])}
        >
          Add rule
        </Button>
      </div>
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px]">
            <Select
              value={rule.category_id}
              onValueChange={(value) =>
                onChange(
                  rules.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, category_id: value ?? "" } : item,
                  ),
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Category">
                  {categories.find((category) => category.id === rule.category_id)?.name ?? "Category"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Count"
              value={rule.question_count}
              onChange={(event) =>
                onChange(
                  rules.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, question_count: event.target.value } : item,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskProfileTemplatesPanel({ canManage }: { canManage: boolean }) {
  const [templates, setTemplates] = useState<RiskTemplate[]>([]);
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewTemplate, setViewTemplate] = useState<RiskTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<RiskTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<RiskTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectionMode, setSelectionMode] = useState<"manual" | "auto">("manual");
  const [rules, setRules] = useState<RuleDraft[]>([{ category_id: "", question_count: "1" }]);
  const [saving, setSaving] = useState(false);
  const [togglingTemplateId, setTogglingTemplateId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const pagination = useMemo(
    () => paginateItems(templates, page, ADMIN_TABLE_PAGE_SIZE),
    [templates, page],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextTemplates, nextCategories] = await Promise.all([
        fetchRiskTemplates(true),
        fetchRiskCategories(true),
      ]);
      setTemplates(nextTemplates);
      setCategories(nextCategories.filter((category) => category.is_active));
    } catch (err) {
      setError(getErrorMessage(err, "Could not load templates."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelectionMode("manual");
    setRules([{ category_id: "", question_count: "1" }]);
  };

  const openEditDialog = (template: RiskTemplate) => {
    setEditTemplate(template);
    setName(template.name);
    setDescription(template.description ?? "");
    setSelectionMode(template.selection_mode);
    setRules(
      template.rules.length
        ? template.rules.map((rule) => ({
            category_id: rule.category_id,
            question_count: String(rule.question_count),
          }))
        : [{ category_id: "", question_count: "1" }],
    );
  };

  const closeEditDialog = () => {
    setEditTemplate(null);
    resetForm();
  };

  const buildRulesPayload = () =>
    rules
      .filter((rule) => rule.category_id)
      .map((rule, index) => ({
        category_id: rule.category_id,
        question_count: Number(rule.question_count),
        sort_order: index,
      }));

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await createRiskTemplate({
        name,
        description: description || undefined,
        selection_mode: selectionMode,
        rules: buildRulesPayload(),
      });
      setMessage("Template created.");
      setCreateDialogOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create template."));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTemplate) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateRiskTemplate(editTemplate.id, {
        name,
        description: description || null,
        selection_mode: selectionMode,
        rules: buildRulesPayload(),
      });
      setMessage("Template updated.");
      closeEditDialog();
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update template."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDefault = async (template: RiskTemplate, nextDefault: boolean) => {
    if (!canManage) return;
    setTogglingTemplateId(template.id);
    setError("");
    try {
      await updateRiskTemplate(template.id, { is_default: nextDefault });
      setMessage(
        nextDefault ? `"${template.name}" set as default template.` : `"${template.name}" removed as default.`,
      );
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update default template."));
    } finally {
      setTogglingTemplateId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateRiskTemplate(deleteTemplate.id, { is_active: false });
      setMessage("Template deactivated.");
      setDeleteTemplate(null);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not deactivate template."));
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSelect = async () => {
    try {
      const result = await autoSelectRiskTemplate();
      setMessage(
        `Auto-selected "${result.template.name}" with ${result.total_questions} questions (target ${result.preferred_question_count}).`,
      );
    } catch (err) {
      setError(getErrorMessage(err, "Could not auto-select template."));
    }
  };

  const templateFormFields = (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="risk-template-name">Name</Label>
        <Input id="risk-template-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="risk-template-description">Description</Label>
        <Input
          id="risk-template-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Selection mode</Label>
        <Select
          value={selectionMode}
          onValueChange={(value) => setSelectionMode(value === "auto" ? "auto" : "manual")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="auto">Auto</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TemplateRulesEditor categories={categories} rules={rules} onChange={setRules} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminSectionTitle>Assessment templates</AdminSectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void handleAutoSelect()}>
            <Sparkles className="size-3.5" />
            Test auto-select
          </Button>
          {canManage ? (
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setCreateDialogOpen(true);
              }}
              disabled={!categories.length}
            >
              <Plus className="size-3.5" />
              Add template
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <AdminDataTable minWidth="lg">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Template</AdminTableHeadCell>
            <AdminTableHeadCell>Mode</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Questions</AdminTableHeadCell>
            <AdminTableHeadCell>Default</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows
            colSpan={TABLE_COLUMN_COUNT}
            loading={loading}
            isEmpty={templates.length === 0}
            emptyMessage="No templates yet."
            skeletonRows={4}
          >
            {pagination.items.map((template) => (
              <AdminTableRow key={template.id}>
                <AdminTableCell>
                  <p className="font-medium text-foreground">{template.name}</p>
                  {template.description ? (
                    <p className="mt-0.5 text-caption text-muted-foreground">{template.description}</p>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell>{templateModeBadge(template.selection_mode)}</AdminTableCell>
                <AdminTableCell className="text-right">{template.total_questions}</AdminTableCell>
                <AdminTableCell>
                  {canManage ? (
                    <Switch
                      checked={template.is_default}
                      disabled={!template.is_active || togglingTemplateId === template.id}
                      onCheckedChange={(checked) => void handleToggleDefault(template, checked)}
                      aria-label={
                        template.is_default ? `Remove ${template.name} as default` : `Set ${template.name} as default`
                      }
                    />
                  ) : (
                    <StatusBadge variant={template.is_default ? "success" : "neutral"} showIcon={false}>
                      {template.is_default ? "Default" : "—"}
                    </StatusBadge>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${template.name}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewTemplate(template)}>View template</DropdownMenuItem>
                      {canManage ? (
                        <>
                          <DropdownMenuItem onClick={() => openEditDialog(template)}>Edit template</DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={!template.is_active}
                            onClick={() => setDeleteTemplate(template)}
                          >
                            Delete template
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>

      <AdminTablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        hasPrevious={pagination.hasPrevious}
        hasNext={pagination.hasNext}
        disabled={loading}
        onPrevious={() => setPage((value) => Math.max(0, value - 1))}
        onNext={() => setPage((value) => value + 1)}
      />

      <AdminDetailDialog
        open={Boolean(viewTemplate)}
        onClose={() => setViewTemplate(null)}
        title="Template"
        description="Review selection mode, default status, and category rules."
        icon={RISK_TEMPLATE_DETAIL_ICON}
        iconTone="info"
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setViewTemplate(null)}>
            Close
          </Button>
        }
      >
        {viewTemplate ? <RiskTemplateDetailView template={viewTemplate} /> : null}
      </AdminDetailDialog>

      <AdminDeleteDialog
        open={Boolean(deleteTemplate)}
        onClose={() => setDeleteTemplate(null)}
        title="Delete template?"
        description="This deactivates the template and removes it from future assessments."
        itemLabel={deleteTemplate?.name}
        confirmLabel="Delete template"
        loading={saving}
        onConfirm={() => void handleDelete()}
      />

      <AdminFormDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          resetForm();
        }}
        title="Add template"
        description="Define how many questions to pull from each category."
        icon={RISK_TEMPLATE_DETAIL_ICON}
        iconTone="info"
        size="lg"
        footer={
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel="Create"
            loading={saving}
            confirmDisabled={!name.trim()}
            onCancel={() => {
              setCreateDialogOpen(false);
              resetForm();
            }}
            onConfirm={() => void handleCreate()}
          />
        }
      >
        {templateFormFields}
      </AdminFormDialog>

      <AdminFormDialog
        open={Boolean(editTemplate)}
        onClose={closeEditDialog}
        title="Edit template"
        description="Update the template name, mode, and category rules."
        icon={RISK_TEMPLATE_DETAIL_ICON}
        iconTone="info"
        size="lg"
        footer={
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel="Save"
            loading={saving}
            confirmDisabled={!name.trim()}
            onCancel={closeEditDialog}
            onConfirm={() => void handleUpdate()}
          />
        }
      >
        {templateFormFields}
      </AdminFormDialog>
    </div>
  );
}
