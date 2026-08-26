"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Info,
  RefreshCw,
  ShoppingCart,
  ShieldCheck,
  Timer,
  Webhook,
  type LucideIcon,
} from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableSkeletonRows,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  expireStaleMfCheckouts,
  fetchMfTransactionOverview,
  type MfTransactionOverview,
} from "@/lib/mf-transactions-admin-api";
import { cn } from "@/lib/utils";

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
  if (minutes == null) return null;
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${minutes} min`;
}

type OpsThresholdRow = {
  key: string;
  category: string;
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  statusLabel: string;
  statusVariant: StatusBadgeVariant;
};

function buildOpsRows(overview: MfTransactionOverview | null): OpsThresholdRow[] {
  const countStatus = (count: number): Pick<OpsThresholdRow, "statusLabel" | "statusVariant"> =>
    count > 0
      ? { statusLabel: "Attention", statusVariant: "warning" }
      : { statusLabel: "Healthy", statusVariant: "success" };

  return [
    {
      key: "stuck-orders",
      category: "Pipeline",
      label: "Stuck orders",
      value: (overview?.stuck_orders ?? 0).toLocaleString(),
      description: "Orders idle longer than the stuck threshold.",
      icon: Activity,
      ...countStatus(overview?.stuck_orders ?? 0),
    },
    {
      key: "stuck-checkouts",
      category: "Pipeline",
      label: "Stuck checkouts",
      value: (overview?.stuck_checkouts ?? 0).toLocaleString(),
      description: "Checkouts waiting beyond the payment expiry window.",
      icon: ShoppingCart,
      ...countStatus(overview?.stuck_checkouts ?? 0),
    },
    {
      key: "failed-orders",
      category: "Pipeline",
      label: "Failed orders (24h)",
      value: (overview?.failed_orders_24h ?? 0).toLocaleString(),
      description: "Orders that failed in the last 24 hours.",
      icon: AlertTriangle,
      ...countStatus(overview?.failed_orders_24h ?? 0),
    },
    {
      key: "failed-webhooks",
      category: "Pipeline",
      label: "Failed webhooks (24h)",
      value: (overview?.failed_webhooks_24h ?? 0).toLocaleString(),
      description: "Webhook events that failed in the last 24 hours.",
      icon: Webhook,
      ...countStatus(overview?.failed_webhooks_24h ?? 0),
    },
    {
      key: "stuck-mandates",
      category: "Pipeline",
      label: "Stuck mandates",
      value: (overview?.stuck_mandates ?? 0).toLocaleString(),
      description: "Mandates awaiting provider sync.",
      icon: ShieldCheck,
      ...countStatus(overview?.stuck_mandates ?? 0),
    },
    {
      key: "stuck-sip-plans",
      category: "Pipeline",
      label: "Stuck SIP plans",
      value: (overview?.stuck_sip_plans ?? 0).toLocaleString(),
      description: "SIP plans awaiting advancement.",
      icon: CalendarClock,
      ...countStatus(overview?.stuck_sip_plans ?? 0),
    },
    {
      key: "stuck-threshold",
      category: "Threshold",
      label: "Stuck threshold",
      value:
        overview?.stuck_threshold_minutes != null
          ? `${overview.stuck_threshold_minutes} min`
          : "—",
      description: "Orders idle longer than this are flagged as stuck.",
      icon: Timer,
      statusLabel: "Config",
      statusVariant: "info",
    },
    {
      key: "payment-expiry",
      category: "Threshold",
      label: "Payment expiry",
      value:
        overview?.payment_expiry_minutes != null
          ? `${overview.payment_expiry_minutes} min`
          : "—",
      description: formatDurationHint(overview?.payment_expiry_minutes)
        ? `Checkout payment window (${formatDurationHint(overview?.payment_expiry_minutes)}).`
        : "Checkout payment window before expiry.",
      icon: Timer,
      statusLabel: "Config",
      statusVariant: "info",
    },
  ];
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
      setOverview(null);
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

  const rows = useMemo(() => buildOpsRows(overview), [overview]);

  const handleExpireStale = async () => {
    if (!canManage) return;
    setActionLoading("expire");
    setError("");
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

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={loading}
            onClick={() => void loadData()}
            aria-label="Refresh ops thresholds"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          {canManage ? (
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading === "expire" || loading}
              onClick={() => void handleExpireStale()}
            >
              <Timer className="size-3.5" />
              {actionLoading === "expire" ? "Expiring…" : "Expire stale checkouts"}
            </Button>
          ) : null}
        </div>
      </div>

      <AdminDataTable minWidth="lg">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Metric</AdminTableHeadCell>
            <AdminTableHeadCell>Category</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Value</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={4} rows={8} />
          ) : !overview ? (
            <AdminTableStateRow colSpan={4}>
              Could not load ops thresholds.
            </AdminTableStateRow>
          ) : (
            rows.map((row) => {
              const Icon = row.icon;
              return (
                <AdminTableRow key={row.key}>
                  <AdminTableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                        <Icon className="size-3.5" strokeWidth={2.25} />
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="font-medium text-foreground">{row.label}</p>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label={`About ${row.label}`}
                              >
                                <Info className="size-3.5" />
                              </Button>
                            }
                          />
                          <TooltipContent
                            side="top"
                            className="max-w-64 text-pretty leading-relaxed"
                          >
                            {row.description}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="text-muted-foreground">{row.category}</AdminTableCell>
                  <AdminTableCell className="text-right font-medium tabular-nums text-foreground">
                    {row.value}
                  </AdminTableCell>
                  <AdminTableCell>
                    <StatusBadge variant={row.statusVariant} showIcon={false}>
                      {row.statusLabel}
                    </StatusBadge>
                  </AdminTableCell>
                </AdminTableRow>
              );
            })
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
