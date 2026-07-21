"use client";

import { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/errors";
import {
  fetchAdminGoalTemplates,
  updateAdminGoalTemplate,
  type AdminGoalTemplate,
} from "@/lib/goals-admin-api";

const TABLE_COLUMN_COUNT = 6;

export function GoalTemplatesPanel() {
  const [templates, setTemplates] = useState<AdminGoalTemplate[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<AdminGoalTemplate>>>({});

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdminGoalTemplates(true);
      setTemplates(response.items);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load goal templates."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const paginated = paginateItems(templates, page, ADMIN_TABLE_PAGE_SIZE);

  function draftFor(template: AdminGoalTemplate) {
    return drafts[template.id] ?? {};
  }

  function updateDraft(templateId: string, patch: Partial<AdminGoalTemplate>) {
    setDrafts((current) => ({
      ...current,
      [templateId]: { ...current[templateId], ...patch },
    }));
  }

  async function handleSave(template: AdminGoalTemplate) {
    const draft = draftFor(template);
    setSavingId(template.id);
    setError("");
    setSuccess("");
    try {
      const updated = await updateAdminGoalTemplate(template.id, {
        name: draft.name ?? template.name,
        description: draft.description ?? template.description ?? null,
        icon_key: draft.icon_key ?? template.icon_key,
        default_tenure_months: Number(draft.default_tenure_months ?? template.default_tenure_months),
        suggested_return_pct: Number(draft.suggested_return_pct ?? template.suggested_return_pct ?? 0),
        is_active: draft.is_active ?? template.is_active,
        sort_order: Number(draft.sort_order ?? template.sort_order),
      });
      setTemplates((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDrafts((current) => {
        const next = { ...current };
        delete next[template.id];
        return next;
      });
      setSuccess(`Updated ${updated.name}.`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update template."));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <AdminSectionTitle
        title="Goal templates"
        description="Predefined goal types seeded at startup. Users pick these when creating personal goals."
        icon={Target}
      />

      {error ? <AdminFeedbackMessage tone="error" message={error} /> : null}
      {success ? <AdminFeedbackMessage tone="success" message={success} /> : null}

      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableRow>
            <AdminTableHeadCell>Name</AdminTableHeadCell>
            <AdminTableHeadCell>Slug</AdminTableHeadCell>
            <AdminTableHeadCell>Tenure</AdminTableHeadCell>
            <AdminTableHeadCell>Return</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
          </AdminTableRow>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows
            loading={loading}
            empty={!loading && templates.length === 0}
            emptyMessage="No goal templates found."
            columnCount={TABLE_COLUMN_COUNT}
          >
            {paginated.items.map((template) => {
              const draft = draftFor(template);
              return (
                <AdminTableRow key={template.id}>
                  <AdminTableCell>
                    <div className="space-y-2">
                      <Input
                        value={draft.name ?? template.name}
                        onChange={(event) => updateDraft(template.id, { name: event.target.value })}
                      />
                      <Input
                        value={draft.description ?? template.description ?? ""}
                        placeholder="Description"
                        onChange={(event) => updateDraft(template.id, { description: event.target.value })}
                      />
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>{template.slug}</AdminTableCell>
                  <AdminTableCell>
                    <div className="space-y-2">
                      <Label className="sr-only">Tenure months</Label>
                      <Input
                        type="number"
                        min={1}
                        value={draft.default_tenure_months ?? template.default_tenure_months}
                        onChange={(event) =>
                          updateDraft(template.id, { default_tenure_months: Number(event.target.value) })
                        }
                      />
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={draft.suggested_return_pct ?? template.suggested_return_pct ?? 0}
                      onChange={(event) =>
                        updateDraft(template.id, { suggested_return_pct: Number(event.target.value) })
                      }
                    />
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={draft.is_active ?? template.is_active}
                        onCheckedChange={(checked) => updateDraft(template.id, { is_active: checked })}
                      />
                      <StatusBadge variant={(draft.is_active ?? template.is_active) ? "success" : "muted"} showIcon={false}>
                        {(draft.is_active ?? template.is_active) ? "Active" : "Inactive"}
                      </StatusBadge>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={savingId === template.id}
                      onClick={() => void handleSave(template)}
                    >
                      {savingId === template.id ? "Saving…" : "Save"}
                    </Button>
                  </AdminTableCell>
                </AdminTableRow>
              );
            })}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>

      <AdminTablePagination
        page={page}
        pageSize={ADMIN_TABLE_PAGE_SIZE}
        totalItems={templates.length}
        onPageChange={setPage}
      />
    </div>
  );
}
