"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge } from "lucide-react";

import { AdminDialogFooterActions, AdminFormDialog } from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { resolveRiskTierBadgeVariant } from "@/lib/risk-tier-admin-ui";
import { fetchRiskTiers, updateRiskTier, type RiskTier } from "@/lib/risk-profile-admin-api";

export function RiskProfileTiersPanel({ canManage }: { canManage: boolean }) {
  const [tiers, setTiers] = useState<RiskTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<RiskTier | null>(null);
  const [title, setTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const filteredTiers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tiers;
    return tiers.filter((tier) =>
      [tier.tier, tier.title, tier.message_body].join(" ").toLowerCase().includes(query),
    );
  }, [search, tiers]);

  const pagination = useMemo(
    () => paginateItems(filteredTiers, page, pageSize),
    [filteredTiers, page, pageSize],
  );

  const showSkeleton = loading && tiers.length === 0;

  const loadTiers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTiers(await fetchRiskTiers());
    } catch (err) {
      setError(getErrorMessage(err, "Could not load tiers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTiers();
  }, [loadTiers]);

  const openEditor = (tier: RiskTier) => {
    setEditing(tier);
    setTitle(tier.title);
    setMessageBody(tier.message_body);
    setMinScore(String(tier.min_score));
    setMaxScore(String(tier.max_score));
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateRiskTier(editing.tier, {
        title,
        message_body: messageBody,
        min_score: Number(minScore),
        max_score: Number(maxScore),
      });
      setMessage("Tier updated.");
      setEditing(null);
      await loadTiers();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update tier."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminSearchInput
        containerClassName="max-w-sm"
        placeholder="Search tiers"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }}
      />

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <AdminDataTable
        minWidth="lg"
        footer={
          <AdminTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            disabled={loading}
            totalCount={filteredTiers.length}
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
            <AdminTableHeadCell>Actions</AdminTableHeadCell>
            <AdminTableHeadCell>Tier</AdminTableHeadCell>
            <AdminTableHeadCell>Score band</AdminTableHeadCell>
            <AdminTableHeadCell>Message</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={4} />
          ) : filteredTiers.length === 0 ? (
            <AdminTableStateRow colSpan={4}>
              {tiers.length === 0
                ? "No tier messages configured."
                : "No tiers match your search."}
            </AdminTableStateRow>
          ) : (
            pagination.items.map((tier) => (
              <AdminTableRow key={tier.tier}>
                <AdminTableCell>
                  {canManage ? (
                    <Button size="sm" variant="outline" onClick={() => openEditor(tier)}>
                      Edit
                    </Button>
                  ) : (
                    "Read only"
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge
                    variant={resolveRiskTierBadgeVariant(tier.tier)}
                    showIcon={false}
                    className="tracking-wide uppercase"
                  >
                    {tier.title}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell>
                  {tier.min_score} – {tier.max_score}
                </AdminTableCell>
                <AdminTableCell className="max-w-md text-caption text-muted-foreground">
                  {tier.message_body}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <AdminFormDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit tier"
        description={
          editing
            ? `Update the score band and completion message for ${editing.title}.`
            : "Tier messages are sent to users when their assessment completes."
        }
        icon={Gauge}
        iconTone="info"
        size="lg"
        footer={
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel="Save"
            loading={saving}
            onCancel={() => setEditing(null)}
            onConfirm={() => void handleSave()}
          />
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="risk-tier-min">Min score</Label>
              <Input id="risk-tier-min" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-tier-max">Max score</Label>
              <Input id="risk-tier-max" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="risk-tier-title">Title</Label>
            <Input id="risk-tier-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="risk-tier-message">Message</Label>
            <textarea
              id="risk-tier-message"
              className="min-h-field-lg w-full rounded-control border border-input bg-transparent px-3 py-2 text-compact"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
            />
          </div>
        </div>
      </AdminFormDialog>
    </div>
  );
}
