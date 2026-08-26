"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  createAdminReferralRewardRule,
  formatReferralInr,
  updateAdminReferralRewardRule,
  type AdminReferralRewardRule,
} from "@/lib/referrals-admin-api";
import { useAdminSearch } from "@/hooks/use-admin-search";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const TRIGGER_OPTIONS: AdminSelectOption[] = [
  { value: "first_investment", label: "First investment" },
  { value: "kyc_verified", label: "KYC verified" },
  { value: "qualified", label: "Qualified" },
  { value: "engaged", label: "Engaged" },
];

const REWARD_TYPE_OPTIONS: AdminSelectOption[] = [
  { value: "flat_inr", label: "Flat INR" },
  { value: "percent", label: "Percent of investment" },
];

function rewardLabel(rule: AdminReferralRewardRule) {
  if (rule.reward_type === "flat_inr") return formatReferralInr(rule.reward_value);
  return `${rule.reward_value}%`;
}

export function ReferralsRewardCategoriesPanel() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("referrals.manage");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localItems, setLocalItems] = useState<AdminReferralRewardRule[] | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    trigger: "first_investment",
    reward_type: "flat_inr",
    reward_value: "100",
    min_investment_inr: "1000",
  });

  const {
    items: searchedItems,
    loading,
    error,
    refetch,
    setError,
  } = useAdminSearch<AdminReferralRewardRule>({
    scope: "referrals.reward_rules",
    query: search,
    limit: 100,
  });

  const items = localItems ?? searchedItems;

  useEffect(() => {
    setLocalItems(null);
  }, [searchedItems]);

  const handleCreate = async () => {
    if (!canManage) return;
    setSaving(true);
    setError("");
    try {
      await createAdminReferralRewardRule({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        trigger: form.trigger as AdminReferralRewardRule["trigger"],
        reward_type: form.reward_type as AdminReferralRewardRule["reward_type"],
        reward_value: Number(form.reward_value),
        min_investment_inr: form.min_investment_inr ? Number(form.min_investment_inr) : null,
        is_active: true,
      });
      setDialogOpen(false);
      setForm({
        name: "",
        description: "",
        trigger: "first_investment",
        reward_type: "flat_inr",
        reward_value: "100",
        min_investment_inr: "1000",
      });
      await refetch();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create reward category."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: AdminReferralRewardRule, isActive: boolean) => {
    if (!canManage) return;
    setError("");
    const previous = items;
    setLocalItems(
      previous.map((item) => (item.id === rule.id ? { ...item, is_active: isActive } : item)),
    );
    try {
      await updateAdminReferralRewardRule(rule.id, { is_active: isActive });
      await refetch();
      setLocalItems(null);
    } catch (err) {
      setLocalItems(previous);
      setError(getErrorMessage(err, "Could not update reward category."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm"
          placeholder="Search category, trigger, reward..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {canManage ? (
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" />
              Add category
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : null}

      <AdminDataTable minWidth="lg">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Category</AdminTableHeadCell>
            <AdminTableHeadCell>Trigger</AdminTableHeadCell>
            <AdminTableHeadCell>Reward</AdminTableHeadCell>
            <AdminTableHeadCell>Min investment</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            {canManage ? <AdminTableHeadCell className="text-right">Active</AdminTableHeadCell> : null}
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading && items.length === 0 ? (
            <AdminTableSkeletonRows columns={canManage ? 6 : 5} />
          ) : items.length === 0 ? (
            <AdminTableStateRow colSpan={canManage ? 6 : 5}>
              {search.trim() ? "No categories match your search." : "No reward categories configured yet."}
            </AdminTableStateRow>
          ) : (
            items.map((rule) => (
              <AdminTableRow key={rule.id}>
                <AdminTableCell>
                  <p className="font-medium text-foreground">{rule.name}</p>
                  {rule.description ? (
                    <p className="mt-0.5 text-caption text-muted-foreground">{rule.description}</p>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell>{rule.trigger.replaceAll("_", " ")}</AdminTableCell>
                <AdminTableCell>{rewardLabel(rule)}</AdminTableCell>
                <AdminTableCell>
                  {rule.min_investment_inr != null ? formatReferralInr(rule.min_investment_inr) : "—"}
                </AdminTableCell>
                <AdminTableCell className="w-[100px]">
                  <StatusBadge variant={rule.is_active ? "success" : "neutral"}>
                    {rule.is_active ? "Active" : "Inactive"}
                  </StatusBadge>
                </AdminTableCell>
                {canManage ? (
                  <AdminTableCell className="w-[72px] text-right">
                    <div className="flex justify-end">
                      <Switch
                        size="sm"
                        checked={rule.is_active}
                        onCheckedChange={(checked) => void handleToggleActive(rule, checked)}
                        aria-label={`Toggle ${rule.name}`}
                      />
                    </div>
                  </AdminTableCell>
                ) : null}
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <AdminFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add reward category"
        description="Define when a reward is earned and how much the referrer receives."
        footer={
          <AdminDialogFooterActions
            onCancel={() => setDialogOpen(false)}
            onConfirm={() => void handleCreate()}
            confirmLabel="Create category"
            loading={saving}
            confirmDisabled={!form.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reward-name">Name</Label>
            <Input
              id="reward-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="First investment bonus"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reward-description">Description</Label>
            <Input
              id="reward-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional details for admins"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Trigger</Label>
              <AdminSelect
                value={form.trigger}
                onValueChange={(value) => setForm((current) => ({ ...current, trigger: value ?? "first_investment" }))}
                options={TRIGGER_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label>Reward type</Label>
              <AdminSelect
                value={form.reward_type}
                onValueChange={(value) => setForm((current) => ({ ...current, reward_type: value ?? "flat_inr" }))}
                options={REWARD_TYPE_OPTIONS}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reward-value">{form.reward_type === "percent" ? "Percent" : "Amount (INR)"}</Label>
              <Input
                id="reward-value"
                inputMode="numeric"
                value={form.reward_value}
                onChange={(event) => setForm((current) => ({ ...current, reward_value: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reward-min">Min investment (INR)</Label>
              <Input
                id="reward-min"
                inputMode="numeric"
                value={form.min_investment_inr}
                onChange={(event) => setForm((current) => ({ ...current, min_investment_inr: event.target.value }))}
              />
            </div>
          </div>
        </div>
      </AdminFormDialog>
    </div>
  );
}
