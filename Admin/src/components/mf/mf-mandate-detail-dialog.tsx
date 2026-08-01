"use client";

import { useEffect, useState } from "react";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format-date";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { OrderStatusBadge } from "@/components/users/user-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { userInitials } from "@/lib/admin-capabilities";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfTransactionMandateDetail,
  syncMfTransactionMandate,
  type MfTransactionMandateDetail,
  type MfTransactionSipPlan,
} from "@/lib/mf-transactions-admin-api";



function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatInr(value?: number | null) {
  if (value == null) return "—";
  return `₹${value.toLocaleString()}`;
}

export function MfMandateDetailDialog({
  open,
  mandateId,
  canManage,
  onClose,
  onUpdated,
}: {
  open: boolean;
  mandateId: string | null;
  canManage: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<MfTransactionMandateDetail | null>(null);

  const loadDetail = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      setDetail(await fetchMfTransactionMandateDetail(id));
    } catch (err) {
      setError(getErrorMessage(err, "Could not load mandate details."));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !mandateId) {
      setDetail(null);
      setError("");
      return;
    }
    void loadDetail(mandateId);
  }, [open, mandateId]);

  const handleSync = async () => {
    if (!mandateId || !canManage) return;
    setSyncing(true);
    setError("");
    try {
      await syncMfTransactionMandate(mandateId);
      await loadDetail(mandateId);
      onUpdated?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not sync mandate."));
    } finally {
      setSyncing(false);
    }
  };

  if (!open || !mandateId) return null;

  const counts = detail?.sip_plan_counts;

  return (
    <AdminDetailDialog
      open={open}
      onClose={onClose}
      title="Mandate details"
      description="SIP plan breakdown and provider mandate status for this user."
      icon={ShieldCheck}
      iconTone="info"
      headerAside={
        canManage ? (
          <Button size="sm" variant="outline" disabled={syncing} onClick={() => void handleSync()}>
            <RotateCcw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
            Sync
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <AdminDetailDialogSkeleton />
      ) : error && !detail ? (
        <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>
      ) : detail ? (
        <div className="space-y-5">
          {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

          <div className="rounded-card border border-border bg-muted/15 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-[var(--radius-card)] border border-border bg-primary/10 p-3 text-primary">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {detail.mandate_type} mandate · {formatInr(detail.mandate_limit)} limit
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <OrderStatusBadge status={detail.status} />
                        {detail.fp_mandate_status ? (
                          <StatusBadge variant="neutral" showIcon={false} className="normal-case">
                            FP · {detail.fp_mandate_status}
                          </StatusBadge>
                        ) : null}
                      </div>
                      {detail.next_action ? (
                        <p className="mt-2 text-caption text-muted-foreground">{detail.next_action}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right text-caption text-muted-foreground">
                    <p>Created {formatTimestamp(detail.created_at)}</p>
                    {detail.approved_at ? <p>Approved {formatTimestamp(detail.approved_at)}</p> : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border px-4 py-3">
                <Avatar className="size-9">
                  {detail.user_profile_image_url ? (
                    <AvatarImage src={detail.user_profile_image_url} alt="" />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {userInitials(detail.user_display_name ?? detail.user_email ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {detail.user_display_name ?? detail.user_email ?? "—"}
                  </p>
                  {detail.client_id ? (
                    <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                      {detail.client_id}
                    </p>
                  ) : null}
                </div>
              </div>

              {counts ? (
                <AdminMetricCardsGrid>
                  <AdminMetricCard
                    label="Total SIP plans"
                    value={counts.total.toLocaleString()}
                    icon={ShieldCheck}
                    tone="muted"
                  />
                  <AdminMetricCard
                    label="Active SIPs"
                    value={counts.active.toLocaleString()}
                    icon={ShieldCheck}
                    tone={counts.active > 0 ? "success" : "muted"}
                  />
                  <AdminMetricCard
                    label="Working SIPs"
                    value={counts.working.toLocaleString()}
                    hint="Pending, review, or consent"
                    icon={ShieldCheck}
                    tone={counts.working > 0 ? "warning" : "muted"}
                  />
                  <AdminMetricCard
                    label="Cancelled SIPs"
                    value={counts.cancelled.toLocaleString()}
                    icon={ShieldCheck}
                    tone={counts.cancelled > 0 ? "warning" : "muted"}
                  />
                </AdminMetricCardsGrid>
              ) : null}

              {detail.failure_reason ? (
                <AdminFeedbackMessage variant="destructive" title="Mandate issue">
                  {detail.failure_reason}
                </AdminFeedbackMessage>
              ) : null}

              <div className="space-y-3">
                <p className="text-compact font-semibold text-foreground">Linked SIP plans</p>
                {detail.sip_plans.length === 0 ? (
                  <p className="text-caption text-muted-foreground">No SIP plans linked to this mandate.</p>
                ) : (
                  <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
                    <table className="w-full min-w-table-md text-left text-compact">
                      <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Fund</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Frequency</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Next installment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.sip_plans.map((plan: MfTransactionSipPlan) => (
                          <tr key={plan.plan_id} className="border-b border-border last:border-b-0">
                            <td className="px-4 py-3 font-medium text-foreground">
                              {plan.product_name ?? plan.product_id}
                            </td>
                            <td className="px-4 py-3 tabular-nums">{formatInr(plan.amount_inr)}</td>
                            <td className="px-4 py-3 capitalize text-muted-foreground">
                              {plan.frequency.toLowerCase()}
                            </td>
                            <td className="px-4 py-3">
                              <OrderStatusBadge status={plan.status} />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(plan.next_installment_date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
    </AdminDetailDialog>
  );
}
