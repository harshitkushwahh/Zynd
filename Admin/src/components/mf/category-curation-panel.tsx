"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ListFilter, Star, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { AdminConfirmDialog, AdminFormDialog } from "@/components/ui/admin-dialog-presets";
import { Button } from "@/components/ui/button";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addMfCategoryFund,
  bulkAddAmcToCategory,
  fetchMfCategoryFunds,
  removeMfCategoryFund,
  setMfCategoryFundOrder,
  updateMfCategory,
  type MfAmc,
  type MfCategoryAdmin,
  type MfCategoryFundCuration,
} from "@/lib/mf-admin-api";
import { cn } from "@/lib/utils";


const NO_AMC = "__none__";

type ConfirmState =
  | { kind: "remove-fund"; productId: string; schemeName: string }
  | { kind: "toggle-visible" }
  | { kind: "bulk-add"; amcName: string };

export function CategoryCurationDialog({
  open,
  category,
  amcs,
  canManage,
  onClose,
  onUpdated,
}: {
  open: boolean;
  category: MfCategoryAdmin;
  amcs: MfAmc[];
  canManage: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  return (
    <AdminFormDialog
      open={open}
      onClose={onClose}
      title={`${category.name} curation`}
      description="Per-category sort order and featured flags drive the public invest catalog."
      icon={ListFilter}
      iconTone="info"
      size="xl"
      bodyClassName="max-h-dialog-body-detail"
    >
      <CategoryCurationPanel
        category={category}
        amcs={amcs}
        canManage={canManage}
        embedded
        onUpdated={onUpdated}
      />
    </AdminFormDialog>
  );
}

export function CategoryCurationPanel({
  category,
  amcs,
  canManage,
  onUpdated,
  embedded = false,
}: {
  category: MfCategoryAdmin;
  amcs: MfAmc[];
  canManage: boolean;
  onUpdated: () => void;
  embedded?: boolean;
}) {
  const [items, setItems] = useState<MfCategoryFundCuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [bulkAmcId, setBulkAmcId] = useState(NO_AMC);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const amcOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: NO_AMC, label: "Bulk add from AMC..." },
      ...amcs.map((amc) => ({
        value: String(amc.id),
        label: amc.name,
      })),
    ],
    [amcs],
  );

  const loadFunds = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchMfCategoryFunds(category.slug);
      setItems(payload.items);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load category funds."));
    } finally {
      setLoading(false);
    }
  }, [category.slug]);

  useEffect(() => {
    void loadFunds();
  }, [loadFunds]);

  const persistOrder = async (nextItems: MfCategoryFundCuration[]) => {
    if (!canManage) return;
    setSaving(true);
    setError("");
    try {
      const payload = await setMfCategoryFundOrder(
        category.slug,
        nextItems.map((item, index) => ({
          product_id: item.product_id,
          display_order: (index + 1) * 10,
          is_featured: item.is_featured,
          featured_rank: item.featured_rank,
        }))
      );
      setItems(payload.items);
      setMessage("Category order saved.");
      onUpdated();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save category order."));
    } finally {
      setSaving(false);
    }
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    void persistOrder(next);
  };

  const toggleFeatured = (index: number) => {
    const next = items.map((item, idx) =>
      idx === index ? { ...item, is_featured: !item.is_featured } : item
    );
    setItems(next);
    void persistOrder(next);
  };

  const updateFeaturedRank = (index: number, value: string) => {
    const next = [...items];
    next[index] = {
      ...next[index],
      featured_rank: value.trim() ? Number(value) : null,
    };
    setItems(next);
  };

  const handleSaveFeaturedRanks = () => {
    void persistOrder(items);
  };

  const handleAddFund = async () => {
    if (!canManage || !addProductId.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload = await addMfCategoryFund(category.slug, {
        product_id: addProductId.trim(),
      });
      setItems(payload.items);
      setAddProductId("");
      setMessage("Fund added to category.");
      onUpdated();
    } catch (err) {
      setError(getErrorMessage(err, "Could not add fund."));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFund = async (productId: string) => {
    if (!canManage) return;
    setSaving(true);
    setError("");
    try {
      const payload = await removeMfCategoryFund(category.slug, productId);
      setItems(payload.items);
      setMessage("Fund removed from category.");
      onUpdated();
    } catch (err) {
      setError(getErrorMessage(err, "Could not remove fund."));
    } finally {
      setSaving(false);
      setConfirmState(null);
    }
  };

  const handleBulkAddAmc = async () => {
    if (!canManage || !bulkAmcId) return;
    setSaving(true);
    setError("");
    try {
      const result = await bulkAddAmcToCategory(category.slug, Number(bulkAmcId));
      setItems(result.category.items);
      setMessage(`Added ${result.added} funds from AMC.`);
      setBulkAmcId("");
      onUpdated();
    } catch (err) {
      setError(getErrorMessage(err, "Could not bulk-add AMC funds."));
    } finally {
      setSaving(false);
      setConfirmState(null);
    }
  };

  const handleToggleVisible = async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      await updateMfCategory(category.id, { is_visible: !category.is_visible });
      setMessage(`Category visibility updated.`);
      onUpdated();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update category."));
    } finally {
      setSaving(false);
      setConfirmState(null);
    }
  };

  const runConfirmAction = () => {
    if (!confirmState) return;
    if (confirmState.kind === "remove-fund") {
      void handleRemoveFund(confirmState.productId);
      return;
    }
    if (confirmState.kind === "toggle-visible") {
      void handleToggleVisible();
      return;
    }
    if (confirmState.kind === "bulk-add") {
      void handleBulkAddAmc();
    }
  };

  const confirmCopy = (() => {
    if (!confirmState) return null;
    if (confirmState.kind === "remove-fund") {
      return {
        title: "Remove fund from category?",
        description: `${confirmState.schemeName} will be removed from ${category.name}. This updates the public catalog immediately.`,
        confirmLabel: "Remove fund",
      };
    }
    if (confirmState.kind === "toggle-visible") {
      return {
        title: category.is_visible ? "Hide category?" : "Show category?",
        description: category.is_visible
          ? `${category.name} will be hidden from the public invest catalog.`
          : `${category.name} will become visible on the public invest catalog.`,
        confirmLabel: category.is_visible ? "Hide category" : "Show category",
        destructive: category.is_visible,
      };
    }
    return {
      title: "Bulk add AMC funds?",
      description: `All eligible funds from ${confirmState.amcName} will be added to ${category.name}.`,
      confirmLabel: "Bulk add",
      destructive: false,
    };
  })();

  const content = (
    <div className={cn("space-y-4", !embedded && "mt-6")}>
        {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
        {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

        <div className="flex flex-wrap gap-2">
          <span className="rounded-[var(--radius-control)] bg-muted px-2 py-1 text-caption">
            Order #{category.display_order}
          </span>
          <span className="rounded-[var(--radius-control)] bg-muted px-2 py-1 text-caption">
            {category.is_visible ? "Visible" : "Hidden"}
          </span>
          {canManage ? (
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => setConfirmState({ kind: "toggle-visible" })}
            >
              {category.is_visible ? "Hide category" : "Show category"}
            </Button>
          ) : null}
        </div>

        {canManage ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex gap-2">
              <Input
                placeholder="Product UUID to add"
                value={addProductId}
                onChange={(event) => setAddProductId(event.target.value)}
              />
              <Button disabled={saving} onClick={() => void handleAddFund()}>
                Add fund
              </Button>
            </div>
            <div className="flex gap-2">
              <AdminSelect
                value={bulkAmcId}
                onValueChange={setBulkAmcId}
                options={amcOptions}
                placeholder="Bulk add from AMC..."
                className="min-w-0 flex-1"
              />
              <Button
                variant="outline"
                disabled={saving || bulkAmcId === NO_AMC}
                onClick={() => {
                  const amc = amcs.find((item) => String(item.id) === bulkAmcId);
                  if (!amc) return;
                  setConfirmState({ kind: "bulk-add", amcName: amc.name });
                }}
              >
                Bulk add
              </Button>
            </div>
          </div>
        ) : null}

        <AdminDataTable minWidth="lg">
          <AdminTableHeader>
            <tr>
              {canManage ? (
                <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
              ) : null}
              <AdminTableHeadCell>#</AdminTableHeadCell>
              <AdminTableHeadCell>Scheme</AdminTableHeadCell>
              <AdminTableHeadCell>Featured</AdminTableHeadCell>
              <AdminTableHeadCell className="text-right">3Y</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeletonRows columns={canManage ? 5 : 4} rows={5} dense />
            ) : items.length === 0 ? (
              <AdminTableStateRow colSpan={canManage ? 5 : 4}>
                No funds in this category yet.
              </AdminTableStateRow>
            ) : (
              items.map((item, index) => (
                <AdminTableRow key={item.product_id}>
                  {canManage ? (
                    <AdminTableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving || index === 0}
                          onClick={() => moveItem(index, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving || index === items.length - 1}
                          onClick={() => moveItem(index, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() =>
                            setConfirmState({
                              kind: "remove-fund",
                              productId: item.product_id,
                              schemeName: item.scheme_name ?? item.product_id,
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </AdminTableCell>
                  ) : null}
                  <AdminTableCell>{index + 1}</AdminTableCell>
                  <AdminTableCell>
                    <p className="font-medium">{item.scheme_name}</p>
                    <p className="text-caption text-muted-foreground">
                      {item.isin ?? item.product_id}
                    </p>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={item.is_featured ? "default" : "outline"}
                        disabled={!canManage || saving}
                        onClick={() => toggleFeatured(index)}
                      >
                        <Star className="size-3.5" />
                      </Button>
                      <Input
                        className="h-8 w-16"
                        placeholder="Rank"
                        defaultValue={item.featured_rank ?? ""}
                        disabled={!canManage}
                        onBlur={(event) => updateFeaturedRank(index, event.target.value)}
                      />
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="text-right tabular-nums">
                    {item.return_3y != null ? `${item.return_3y.toFixed(2)}%` : "—"}
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminDataTable>

        {canManage ? (
          <Button variant="outline" disabled={saving || loading} onClick={() => void handleSaveFeaturedRanks()}>
            Save featured ranks
          </Button>
        ) : null}

      {confirmCopy ? (
        <AdminConfirmDialog
          open
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          confirmVariant={confirmCopy.destructive ?? true ? "destructive" : "default"}
          loading={saving}
          onClose={() => setConfirmState(null)}
          onConfirm={runConfirmAction}
        />
      ) : null}
    </div>
  );

  if (embedded) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{category.name} curation</CardTitle>
        <CardDescription>
          Per-category sort order and featured flags drive the public invest catalog.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
