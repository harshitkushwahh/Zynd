"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  ShoppingCart,
  ShieldCheck,
  Timer,
  Webhook,
} from "lucide-react";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  expireStaleMfCheckouts,
  fetchMfTransactionOverview,
  type MfTransactionOverview,
} from "@/lib/mf-transactions-admin-api";


function orderBadgeVariant(status: string): StatusBadgeVariant {
  if (status === "succeeded" || status === "active") return "success";
  if (status === "failed" || status === "cancelled") return "destructive";
  if (status === "payment_pending" || status === "submitted" || status === "processing") {
    return "warning";
  }
  return "neutral";
}

function formatOrderStatusLabel(status: string) {
  return status.replaceAll("_", " ").toUpperCase();
}

function formatDurationHint(minutes: number | undefined) {
  if (minutes == null) return undefined;
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return undefined;
}

export function MfTransactionOpsThresholdsPanel({
  canRead,
  canManage,
}: {
  canRead: boolean;
  canManage: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [overview, setOverview] = useState<MfTransactionOverview | null>(null);

  const loadData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError("");
    try {
      setOverview(await fetchMfTransactionOverview());
    } catch (err) {
      setError(getErrorMessage(err, "Could not load ops thresholds."));
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const orderStatusCounts = useMemo(() => {
    if (!overview?.order_counts) return [];
    return Object.entries(overview.order_counts).sort(([, left], [, right]) => right - left);
  }, [overview?.order_counts]);

  const handleExpireStale = async () => {
    if (!canManage) return;
    setActionLoading("expire");
    setMessage("");
    try {
      const result = await expireStaleMfCheckouts();
      setMessage(`Expired ${result.expired_checkouts ?? 0} stale checkout(s).`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not expire stale checkouts."));
    } finally {
      setActionLoading(null);
    }
  };

  const overviewMetrics = [
    {
      key: "stuck-orders",
      label: "Stuck orders",
      value: (overview?.stuck_orders ?? 0).toLocaleString(),
      icon: Activity,
      tone: (overview?.stuck_orders ?? 0) > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      key: "stuck-checkouts",
      label: "Stuck checkouts",
      value: (overview?.stuck_checkouts ?? 0).toLocaleString(),
      icon: ShoppingCart,
      tone: (overview?.stuck_checkouts ?? 0) > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      key: "failed-orders",
      label: "Failed orders (24h)",
      value: (overview?.failed_orders_24h ?? 0).toLocaleString(),
      icon: AlertTriangle,
      tone: (overview?.failed_orders_24h ?? 0) > 0 ? ("warning" as const) : ("muted" as const),
    },
    {
      key: "failed-webhooks",
      label: "Failed webhooks (24h)",
      value: (overview?.failed_webhooks_24h ?? 0).toLocaleString(),
      icon: Webhook,
      tone: (overview?.failed_webhooks_24h ?? 0) > 0 ? ("warning" as const) : ("muted" as const),
    },
  ];

  return (
    <div className="space-y-5">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewMetrics.map((metric) => (
          <AdminMetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            tone={metric.tone}
            loading={loading}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/15 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <AdminSectionTitle
            icon={Timer}
            variant="section"
            description="Reconciliation windows and stuck pipeline counts."
          >
            Ops thresholds
          </AdminSectionTitle>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {orderStatusCounts.map(([status, count]) => (
              <StatusBadge
                key={status}
                variant={orderBadgeVariant(status)}
                showIcon={false}
                className="normal-case"
              >
                {formatOrderStatusLabel(status)} · {count.toLocaleString()}
              </StatusBadge>
            ))}
            {canManage ? (
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading === "expire"}
                onClick={() => void handleExpireStale()}
              >
                <Timer className="size-3.5" />
                {actionLoading === "expire" ? "Expiring…" : "Expire stale checkouts"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Stuck threshold"
              value={
                overview?.stuck_threshold_minutes != null
                  ? `${overview.stuck_threshold_minutes} min`
                  : "No data"
              }
              hint="Orders idle longer than this are flagged"
              icon={Timer}
              tone="muted"
              loading={loading}
            />
            <AdminMetricCard
              label="Payment expiry"
              value={
                overview?.payment_expiry_minutes != null
                  ? `${overview.payment_expiry_minutes} min`
                  : "No data"
              }
              hint={formatDurationHint(overview?.payment_expiry_minutes)}
              icon={Activity}
              tone="muted"
              loading={loading}
            />
            <AdminMetricCard
              label="Stuck mandates"
              value={(overview?.stuck_mandates ?? 0).toLocaleString()}
              hint="Mandates awaiting provider sync"
              icon={ShieldCheck}
              tone={(overview?.stuck_mandates ?? 0) > 0 ? "warning" : "success"}
              loading={loading}
            />
            <AdminMetricCard
              label="Stuck SIP plans"
              value={(overview?.stuck_sip_plans ?? 0).toLocaleString()}
              hint="SIP plans awaiting advancement"
              icon={CalendarClock}
              tone={(overview?.stuck_sip_plans ?? 0) > 0 ? "warning" : "success"}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
