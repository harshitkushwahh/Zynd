"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import {
  RiskCategoryDetailView,
  RISK_CATEGORY_DETAIL_ICON,
} from "@/components/risk-profile/risk-profile-detail-views";
import {
  AdminDeleteDialog,
  AdminDetailDialog,
  AdminDialogFooterActions,
  AdminFormDialog,
} from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
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
import { StatusBadge } from "@/components/ui/status-badge";
import { getErrorMessage } from "@/lib/errors";
import {
  createRiskCategory,
  fetchRiskCategories,
  updateRiskCategory,
  type RiskCategory,
} from "@/lib/risk-profile-admin-api";

const ALL = "all";
const STATUS_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function RiskProfileCategoriesPanel({ canManage }: { canManage: boolean }) {
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewCategory, setViewCategory] = useState<RiskCategory | null>(null);
  const [editCategory, setEditCategory] = useState<RiskCategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<RiskCategory | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("0.25");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categories.filter((category) => {
      if (statusFilter === "active" && !category.is_active) return false;
      if (statusFilter === "inactive" && category.is_active) return false;
      if (!query) return true;
      return [category.name, category.slug, category.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [categories, search, statusFilter]);

  const pagination = useMemo(
    () => paginateItems(filteredCategories, page, pageSize),
    [filteredCategories, page, pageSize],
  );

  const tableColumnCount = 6;
  const showSkeleton = loading && categories.length === 0;

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCategories(await fetchRiskCategories(true));
    } catch (err) {
      setError(getErrorMessage(err, "Could not load categories."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    setWeight("0.25");
    setSortOrder("0");
  };

  const openEditDialog = (category: RiskCategory) => {
    setEditCategory(category);
    setName(category.name);
    setDescription(category.description ?? "");
    setWeight(String(category.weight));
    setSortOrder(String(category.sort_order));
  };

  const closeEditDialog = () => {
    setEditCategory(null);
    resetCreateForm();
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await createRiskCategory({
        name,
        description: description || undefined,
        weight: Number(weight),
        sort_order: Number(sortOrder),
      });
      setMessage("Category created.");
      setCreateDialogOpen(false);
      resetCreateForm();
      await loadCategories();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create category."));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editCategory) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateRiskCategory(editCategory.id, {
        name,
        description: description || null,
        weight: Number(weight),
        sort_order: Number(sortOrder),
      });
      setMessage("Category updated.");
      closeEditDialog();
      await loadCategories();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update category."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCategory) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateRiskCategory(deleteCategory.id, { is_active: false });
      setMessage("Category deactivated.");
      setDeleteCategory(null);
      await loadCategories();
    } catch (err) {
      setError(getErrorMessage(err, "Could not deactivate category."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search categories"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <AdminSelect
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(0);
            }}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Status"
            className="min-w-select-sm"
          />
          {canManage ? (
            <Button
              size="sm"
              onClick={() => {
                resetCreateForm();
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Add category
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <AdminDataTable
        minWidth="md"
        footer={
          <AdminTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            disabled={loading}
            totalCount={filteredCategories.length}
            currentPageCount={pagination.items.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(0);
            }}
            onPrevious={() => setPage((value) => Math.max(0, value - 1))}
            onNext={() => setPage((value) => value + 1)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
            <AdminTableHeadCell>Name</AdminTableHeadCell>
            <AdminTableHeadCell>Slug</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Weight</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Questions</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={tableColumnCount} rows={4} />
          ) : filteredCategories.length === 0 ? (
            <AdminTableStateRow colSpan={tableColumnCount}>
              {categories.length === 0 ? "No categories yet." : "No categories match your filters."}
            </AdminTableStateRow>
          ) : (
            pagination.items.map((category) => (
              <AdminTableRow key={category.id}>
                <AdminTableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${category.name}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewCategory(category)}>
                        View category
                      </DropdownMenuItem>
                      {canManage ? (
                        <>
                          <DropdownMenuItem onClick={() => openEditDialog(category)}>
                            Edit category
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={!category.is_active}
                            onClick={() => setDeleteCategory(category)}
                          >
                            Delete category
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </AdminTableCell>
                <AdminTableCell>
                  <p className="font-medium text-foreground">{category.name}</p>
                  {category.description ? (
                    <p className="mt-0.5 text-caption text-muted-foreground">{category.description}</p>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-caption">{category.slug}</AdminTableCell>
                <AdminTableCell className="text-right">{category.weight.toFixed(4)}</AdminTableCell>
                <AdminTableCell className="text-right">{category.question_count ?? 0}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={category.is_active ? "success" : "neutral"} showIcon={false}>
                    {category.is_active ? "Active" : "Inactive"}
                  </StatusBadge>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <AdminFormDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          resetCreateForm();
        }}
        title="Add category"
        description="Categories carry weights used in the 0–1000 risk score."
        icon={RISK_CATEGORY_DETAIL_ICON}
        iconTone="info"
        footer={
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel="Create"
            loading={saving}
            confirmDisabled={!name.trim()}
            onCancel={() => {
              setCreateDialogOpen(false);
              resetCreateForm();
            }}
            onConfirm={() => void handleCreate()}
          />
        }
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="risk-category-name">Name</Label>
            <Input id="risk-category-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="risk-category-description">Description</Label>
            <Input
              id="risk-category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="risk-category-weight">Weight (0–1)</Label>
              <Input id="risk-category-weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-category-sort">Sort order</Label>
              <Input id="risk-category-sort" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
          </div>
        </div>
      </AdminFormDialog>

      <AdminFormDialog
        open={Boolean(editCategory)}
        onClose={closeEditDialog}
        title="Edit category"
        description="Update the category name, weight, and ordering. The slug stays unchanged."
        icon={RISK_CATEGORY_DETAIL_ICON}
        iconTone="info"
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
        {editCategory ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="risk-category-edit-slug">Slug</Label>
              <Input id="risk-category-edit-slug" value={editCategory.slug} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-category-edit-name">Name</Label>
              <Input
                id="risk-category-edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-category-edit-description">Description</Label>
              <Input
                id="risk-category-edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="risk-category-edit-weight">Weight (0–1)</Label>
                <Input
                  id="risk-category-edit-weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-category-edit-sort">Sort order</Label>
                <Input
                  id="risk-category-edit-sort"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </AdminFormDialog>

      <AdminDetailDialog
        open={Boolean(viewCategory)}
        onClose={() => setViewCategory(null)}
        title="Category"
        description="Weighted category used in the 0–1000 risk score."
        icon={RISK_CATEGORY_DETAIL_ICON}
        iconTone="info"
        footer={
          <Button variant="outline" onClick={() => setViewCategory(null)}>
            Close
          </Button>
        }
      >
        {viewCategory ? <RiskCategoryDetailView category={viewCategory} /> : null}
      </AdminDetailDialog>

      <AdminDeleteDialog
        open={Boolean(deleteCategory)}
        onClose={() => setDeleteCategory(null)}
        title="Delete category?"
        description="This deactivates the category and removes it from new assessments. Existing questions remain linked."
        itemLabel={deleteCategory?.name}
        confirmLabel="Delete category"
        loading={saving}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
