"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import {
  RiskQuestionDetailView,
  RISK_QUESTION_DETAIL_ICON,
} from "@/components/risk-profile/risk-profile-detail-views";
import {
  RiskProfileBulkImportActions,
  RiskProfileBulkImportFeedback,
  RiskProfileBulkImportRoot,
} from "@/components/risk-profile/risk-profile-bulk-panel";
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
  createRiskQuestion,
  deleteRiskQuestion,
  fetchRiskCategories,
  fetchRiskQuestions,
  updateRiskQuestion,
  type RiskCategory,
  type RiskQuestion,
} from "@/lib/risk-profile-admin-api";

type OptionDraft = { label: string; score_value: string };
type DialogMode = "create" | "edit";

const EMPTY_OPTION = (): OptionDraft => ({ label: "", score_value: "0" });
const TABLE_COLUMN_COUNT = 4;

function normalizeOptions(options: OptionDraft[]) {
  return options
    .filter((option) => option.label.trim())
    .slice(0, 4)
    .map((option, index) => ({
      label: option.label.trim(),
      score_value: Number(option.score_value),
      sort_order: index,
    }));
}

function optionsFromQuestion(question: RiskQuestion): OptionDraft[] {
  const drafts = question.options.map((option) => ({
    label: option.label,
    score_value: String(option.score_value),
  }));
  while (drafts.length < 2) {
    drafts.push(EMPTY_OPTION());
  }
  return drafts;
}

function resolveFormCategories(
  activeCategories: RiskCategory[],
  categories: RiskCategory[],
  categoryId: string,
  editingQuestion: RiskQuestion | null,
) {
  const merged = new Map(activeCategories.map((category) => [category.id, category]));

  const ensureCategory = (id: string | undefined) => {
    if (!id || merged.has(id)) return;
    const category = categories.find((item) => item.id === id);
    if (category) merged.set(id, category);
  };

  ensureCategory(editingQuestion?.category_id);
  ensureCategory(categoryId);

  return Array.from(merged.values());
}

export function RiskProfileQuestionsPanel({ canManage }: { canManage: boolean }) {
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [questions, setQuestions] = useState<RiskQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [viewQuestion, setViewQuestion] = useState<RiskQuestion | null>(null);
  const [deleteQuestion, setDeleteQuestion] = useState<RiskQuestion | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<RiskQuestion | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [helpText, setHelpText] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([EMPTY_OPTION(), EMPTY_OPTION()]);
  const [saving, setSaving] = useState(false);
  const [togglingQuestionId, setTogglingQuestionId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const pagination = useMemo(
    () => paginateItems(questions, page, ADMIN_TABLE_PAGE_SIZE),
    [questions, page],
  );

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  );

  const formCategories = useMemo(
    () => resolveFormCategories(activeCategories, categories, categoryId, editingQuestion),
    [activeCategories, categories, categoryId, editingQuestion],
  );

  const selectedCategory = useMemo(
    () => formCategories.find((category) => category.id === categoryId),
    [formCategories, categoryId],
  );

  const categoryLabel = useMemo(() => {
    if (selectedCategory?.name) return selectedCategory.name;
    if (editingQuestion?.category_name) return editingQuestion.category_name;
    if (editingQuestion?.category_slug) return editingQuestion.category_slug;
    return "Select category";
  }, [editingQuestion, selectedCategory]);

  const hasValidOptions = useMemo(
    () => options.some((option) => option.label.trim()),
    [options],
  );

  const canSave = Boolean(categoryId && prompt.trim() && hasValidOptions);

  const resetDialog = useCallback(() => {
    setEditingQuestion(null);
    setPrompt("");
    setHelpText("");
    setOptions([EMPTY_OPTION(), EMPTY_OPTION()]);
    setCategoryId(activeCategories[0]?.id ?? "");
  }, [activeCategories]);

  const openCreateDialog = () => {
    setDialogMode("create");
    resetDialog();
    setDialogOpen(true);
  };

  const openEditDialog = (question: RiskQuestion) => {
    setDialogMode("edit");
    setEditingQuestion(question);
    setCategoryId(question.category_id);
    setPrompt(question.prompt);
    setHelpText(question.help_text ?? "");
    setOptions(optionsFromQuestion(question));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetDialog();
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextCategories, nextQuestions] = await Promise.all([
        fetchRiskCategories(true),
        fetchRiskQuestions({ includeInactive: true }),
      ]);
      setCategories(nextCategories);
      setQuestions(nextQuestions);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load questions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!categoryId && activeCategories[0]) {
      setCategoryId(activeCategories[0].id);
    }
  }, [activeCategories, categoryId]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        category_id: categoryId,
        prompt,
        help_text: helpText || undefined,
        options: normalizeOptions(options),
      };

      if (dialogMode === "create") {
        await createRiskQuestion(payload);
        setMessage("Question created.");
      } else if (editingQuestion) {
        await updateRiskQuestion(editingQuestion.id, {
          category_id: categoryId,
          prompt,
          help_text: helpText || null,
          options: payload.options,
        });
        setMessage("Question updated.");
      }

      closeDialog();
      await loadData();
    } catch (err) {
      setError(
        getErrorMessage(err, dialogMode === "create" ? "Could not create question." : "Could not update question."),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (question: RiskQuestion, nextActive: boolean) => {
    if (!canManage) return;
    setTogglingQuestionId(question.id);
    setError("");
    try {
      await updateRiskQuestion(question.id, { is_active: nextActive });
      setMessage(nextActive ? "Question activated." : "Question deactivated.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update question status."));
    } finally {
      setTogglingQuestionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteQuestion) return;
    setSaving(true);
    setError("");
    try {
      await deleteRiskQuestion(deleteQuestion.id);
      setMessage("Question deactivated.");
      setDeleteQuestion(null);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not deactivate question."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RiskProfileBulkImportRoot canManage={canManage} onImportComplete={loadData}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminSectionTitle>Question bank</AdminSectionTitle>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <RiskProfileBulkImportActions />
              <Button size="sm" onClick={openCreateDialog} disabled={!activeCategories.length}>
                <Plus className="size-3.5" />
                Add question
              </Button>
            </div>
          ) : null}
        </div>

        <RiskProfileBulkImportFeedback />

        {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
        {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

        <AdminDataTable minWidth="lg">
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Question</AdminTableHeadCell>
              <AdminTableHeadCell>Category</AdminTableHeadCell>
              <AdminTableHeadCell>Active</AdminTableHeadCell>
              <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            <AdminTableRows
              colSpan={TABLE_COLUMN_COUNT}
              loading={loading}
              isEmpty={questions.length === 0}
              emptyMessage="No questions yet."
            >
              {pagination.items.map((question) => (
                <AdminTableRow key={question.id}>
                  <AdminTableCell>
                    <p className="font-medium text-foreground">{question.prompt}</p>
                    {question.help_text ? (
                      <p className="mt-0.5 text-caption text-muted-foreground">{question.help_text}</p>
                    ) : null}
                  </AdminTableCell>
                  <AdminTableCell>{question.category_name ?? question.category_slug}</AdminTableCell>
                  <AdminTableCell>
                    {canManage ? (
                      <Switch
                        checked={question.is_active}
                        disabled={togglingQuestionId === question.id}
                        onCheckedChange={(checked) => void handleToggleActive(question, checked)}
                        aria-label={question.is_active ? "Deactivate question" : "Activate question"}
                      />
                    ) : (
                      <StatusBadge variant={question.is_active ? "success" : "neutral"} showIcon={false}>
                        {question.is_active ? "Active" : "Inactive"}
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
                            aria-label="Actions for question"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewQuestion(question)}>
                          View question
                        </DropdownMenuItem>
                        {canManage ? (
                          <>
                            <DropdownMenuItem onClick={() => openEditDialog(question)}>
                              Edit question
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={!question.is_active}
                              onClick={() => setDeleteQuestion(question)}
                            >
                              Delete question
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
          open={Boolean(viewQuestion)}
          onClose={() => setViewQuestion(null)}
          title="Question"
          description="Review the prompt, category, and scored answer options."
          icon={RISK_QUESTION_DETAIL_ICON}
          iconTone="info"
          size="lg"
          footer={
            <Button variant="outline" onClick={() => setViewQuestion(null)}>
              Close
            </Button>
          }
        >
          {viewQuestion ? <RiskQuestionDetailView question={viewQuestion} /> : null}
        </AdminDetailDialog>

        <AdminDeleteDialog
          open={Boolean(deleteQuestion)}
          onClose={() => setDeleteQuestion(null)}
          title="Delete question?"
          description="This deactivates the question and removes it from future assessments."
          itemLabel={deleteQuestion?.prompt}
          confirmLabel="Delete question"
          loading={saving}
          onConfirm={() => void handleDelete()}
        />

        <AdminFormDialog
          open={dialogOpen}
          onClose={closeDialog}
          title={dialogMode === "create" ? "Add question" : "Edit question"}
          description="Choose a category, write the prompt, and add up to four scored options (0–100)."
          icon={RISK_QUESTION_DETAIL_ICON}
          iconTone="info"
          size="lg"
          footer={
            <AdminDialogFooterActions
              cancelLabel="Cancel"
              confirmLabel={dialogMode === "create" ? "Create" : "Save"}
              loading={saving}
              confirmDisabled={!canSave}
              onCancel={closeDialog}
              onConfirm={() => void handleSave()}
            />
          }
        >
          <div className="grid gap-6">
            <div className="grid gap-4">
              <p className="text-compact font-semibold text-foreground">Question details</p>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category">{categoryLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {formCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-question-prompt">Prompt</Label>
                <Input id="risk-question-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-question-help">Help text</Label>
                <Input
                  id="risk-question-help"
                  value={helpText}
                  onChange={(e) => setHelpText(e.target.value)}
                  placeholder="Optional guidance shown below the prompt"
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-compact font-semibold text-foreground">Scored options</p>
                {options.length < 4 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOptions((current) => [...current, EMPTY_OPTION()])}
                  >
                    Add option
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px]">
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={option.label}
                      onChange={(e) =>
                        setOptions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, label: e.target.value } : item,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder="Score"
                      value={option.score_value}
                      onChange={(e) =>
                        setOptions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, score_value: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AdminFormDialog>
      </div>
    </RiskProfileBulkImportRoot>
  );
}
