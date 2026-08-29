"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Copy, Hash, Receipt, RotateCcw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { clientIdToProfilePath } from "@/lib/admin-user-ref";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { formatTimestamp } from "@/lib/format-date";

import { AmcLogo } from "@/components/mf/amc-logo";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { userInitials } from "@/lib/admin-capabilities";
import { resolveAdminAssetUrl } from "@/lib/mf-admin-asset-url";
import {
  buildOrderJourneyView,
  formatFailureSummary,
  formatFpState,
  formatFriendlyStatus,
  resolveProviderStatusLabel,
  type JourneyDisplayStep,
} from "@/lib/mf-order-journey-copy";
import {
  fetchMfTransactionOrderDetail,
  syncMfTransactionOrder,
  type MfTransactionOrder,
  type MfTransactionOrderDetail,
} from "@/lib/mf-transactions-admin-api";
import { cn } from "@/lib/utils";

function IdTile({ label, value }: { label: string; value?: string | null }) {
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(value);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-w-0 rounded-[var(--radius-control)] border border-border/80 bg-muted/10 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-tiny font-medium text-muted-foreground">{label}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          disabled={!canCopy}
          onClick={() => void handleCopy()}
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      <p className="mt-1.5 break-all font-mono text-micro leading-relaxed text-foreground/90">
        {value ?? "Not available"}
      </p>
    </div>
  );
}

function providerBadgeVariant(order: MfTransactionOrder) {
  if (order.failure_code === "payment_abandoned") return "warning" as const;
  if (order.status === "cancelled" || order.status === "failed") return "destructive" as const;
  if (order.status === "succeeded") return "success" as const;
  return "info" as const;
}

function OrderPartiesCard({ order }: { order: MfTransactionOrder }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-compact font-semibold text-foreground">Customer & references</p>
        <StatusBadge variant={providerBadgeVariant(order)}>
          {resolveProviderStatusLabel(order)}
        </StatusBadge>
      </div>

      <div className="space-y-4 p-4">
        <MfOrderCustomerCell order={order} />

        <Separator />

        <div>
          <div className="mb-3 flex items-center gap-2 text-caption font-medium text-muted-foreground">
            <Hash className="size-3.5" />
            Transaction references
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <IdTile label="Purchase reference" value={order.fp_purchase_id} />
            <IdTile label="Checkout" value={order.checkout_id} />
            <IdTile label="Order ID" value={order.order_id} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MfOrderCustomerCell({ order }: { order: MfTransactionOrder }) {
  const profileUrl = resolveAdminAssetUrl(order.user_profile_image_url);
  const email = order.user_email ?? "No email";
  const displayName = order.user_display_name ?? email;
  const profileHref = order.client_id
    ? `/dashboard/users/${encodeURIComponent(clientIdToProfilePath(order.client_id))}`
    : null;

  return (
    <div className="flex items-center gap-3">
      <Avatar size="sm">
        {profileUrl ? <AvatarImage src={profileUrl} alt="" /> : null}
        <AvatarFallback className="text-caption font-medium">
          {userInitials(email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        {profileHref ? (
          <Link
            href={profileHref}
            className="block truncate font-medium text-foreground hover:text-primary"
            onClick={(event) => event.stopPropagation()}
          >
            {displayName}
          </Link>
        ) : (
          <p className="truncate font-medium text-foreground">{displayName}</p>
        )}
        <p className="mt-0.5 truncate text-caption text-muted-foreground">{email}</p>
      </div>
    </div>
  );
}

export function MfOrderFundCell({ order }: { order: MfTransactionOrder }) {
  return (
    <div className="flex items-center gap-3">
      <AmcLogo name={order.product_name} logoUrl={order.amc_logo_url} size="sm" fallback="icon" />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {order.product_name ?? "No data"}
        </p>
        <p className="mt-0.5 truncate font-mono text-caption text-muted-foreground">
          {order.order_id}
        </p>
      </div>
    </div>
  );
}

function JourneyEventRow({
  step,
  isLast,
}: {
  step: JourneyDisplayStep;
  isLast: boolean;
}) {
  const isTerminal = step.isTerminal;

  return (
    <div className="flex gap-3">
      <div className="flex w-timeline-rail flex-col items-center self-stretch">
        <span
          className={cn(
            "relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full border",
            isTerminal
              ? "border-destructive/40 bg-destructive/10"
              : "border-border bg-card",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              isTerminal ? "bg-destructive" : "bg-primary",
            )}
          />
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
      </div>
      <div
        className={cn(
          "mb-5 min-w-0 flex-1 rounded-[var(--radius-control)] border px-3 py-3",
          isTerminal
            ? "border-destructive/35 bg-destructive/5"
            : "border-border/70 bg-muted/10",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{step.title}</p>
          <StatusBadge
            variant={isTerminal ? "destructive" : orderBadgeVariant(step.event.to_status)}
            showIcon
            className="normal-case"
          >
            {step.toStatus}
          </StatusBadge>
        </div>
        {step.description ? (
          <p className="mt-1.5 text-compact leading-relaxed text-muted-foreground">{step.description}</p>
        ) : null}
        <p className="mt-2 text-caption text-muted-foreground">
          {formatTimestamp(step.event.created_at)} · {step.actor}
        </p>
      </div>
    </div>
  );
}

function orderBadgeVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "succeeded" || normalized === "active") return "success" as const;
  if (normalized === "failed" || normalized === "cancelled") return "destructive" as const;
  if (
    normalized === "payment_pending" ||
    normalized === "submitted" ||
    normalized === "processing"
  ) {
    return "warning" as const;
  }
  return "neutral" as const;
}

const IN_FLIGHT_ORDER_STATUSES = new Set([
  "pending",
  "submitted",
  "payment_pending",
  "processing",
]);
const ORDER_POLL_MS = 4000;

function isInFlightOrder(status?: string | null) {
  return IN_FLIGHT_ORDER_STATUSES.has((status ?? "").toLowerCase());
}

function OrderFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-tiny font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-compact text-foreground">{value}</p>
    </div>
  );
}

function OrderFactsCard({ order }: { order: MfTransactionOrder }) {
  const paymentMethod = order.payment_method
    ? formatFriendlyStatus(order.payment_method)
    : "—";
  const nextAction = order.next_action ? formatFriendlyStatus(order.next_action) : "None";

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
      <p className="text-compact font-semibold text-foreground">Order facts</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <OrderFact label="Payment method" value={paymentMethod} />
        <OrderFact label="Provider state" value={formatFpState(order.fp_state)} />
        <OrderFact label="Next action" value={nextAction} />
        <OrderFact label="Product ID" value={order.product_id ?? "—"} />
        <OrderFact label="Created" value={formatTimestamp(order.created_at)} />
        <OrderFact label="Submitted" value={formatTimestamp(order.submitted_at)} />
        <OrderFact label="Settled" value={formatTimestamp(order.settled_at)} />
        <OrderFact
          label="Payment link"
          value={
            order.payment_url ? (
              <a
                href={order.payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary hover:underline"
              >
                Open payment URL
              </a>
            ) : (
              "—"
            )
          }
        />
      </div>
    </div>
  );
}

export function MfOrderJourneyDialog({
  open,
  orderId,
  onClose,
}: {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
}) {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("mf.transactions.manage");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<MfTransactionOrderDetail | null>(null);

  const loadDetail = useCallback(async (id: string, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const result = await fetchMfTransactionOrderDetail(id);
      setDetail(result);
    } catch (err) {
      if (!silent) {
        setError(getErrorMessage(err, "Could not load order journey."));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !orderId) {
      setDetail(null);
      setError("");
      setPolling(false);
      return;
    }

    void loadDetail(orderId);
  }, [loadDetail, open, orderId]);

  useEffect(() => {
    if (!open || !orderId || !isInFlightOrder(detail?.order.status)) {
      setPolling(false);
      return;
    }

    setPolling(true);
    const timer = window.setInterval(() => {
      void loadDetail(orderId, true);
    }, ORDER_POLL_MS);

    return () => {
      window.clearInterval(timer);
      setPolling(false);
    };
  }, [detail?.order.status, loadDetail, open, orderId]);

  const handleSync = async () => {
    if (!canManage || !orderId) return;
    setSyncing(true);
    setError("");
    try {
      await syncMfTransactionOrder(orderId);
      await loadDetail(orderId, true);
    } catch (err) {
      setError(getErrorMessage(err, "Could not sync this order."));
    } finally {
      setSyncing(false);
    }
  };

  if (!open || !orderId) return null;

  const order = detail?.order;
  const events = detail?.events ?? [];
  const journey = order ? buildOrderJourneyView(order, events) : null;
  const failureSummary = order ? formatFailureSummary(order) : null;

  return (
    <AdminDetailDialog
      open={open}
      onClose={onClose}
      title="Transaction details"
      description="Follow the order from placement through payment, allotment, and settlement."
      icon={Receipt}
      iconTone="info"
      headerAside={
        polling ? (
          <StatusBadge variant="info" showIcon={false}>
            Live
          </StatusBadge>
        ) : null
      }
    >
      {loading ? (
        <AdminDetailDialogSkeleton />
      ) : error && !order ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage>
      ) : order ? (
        <div className="space-y-5">
          {error ? (
            <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage>
          ) : null}
          <div className="rounded-card border border-border bg-muted/15 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <AmcLogo name={order.product_name} logoUrl={order.amc_logo_url} fallback="icon" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{order.product_name ?? "No data"}</p>
                  <p className="mt-1 text-caption capitalize text-muted-foreground">
                    {order.order_type?.replaceAll("_", " ") ?? "Order"}
                    {order.amc_name ? ` · ${order.amc_name}` : ""}
                  </p>
                  <div className="mt-2">
                    <StatusBadge
                      variant={orderBadgeVariant(order.status)}
                      showIcon
                      className="normal-case"
                    >
                      {formatFriendlyStatus(order.status)}
                    </StatusBadge>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <p className="font-heading text-h4 font-semibold tabular-nums text-foreground">
                  ₹{order.amount_inr.toLocaleString()}
                </p>
                <p className="text-caption text-muted-foreground">
                  Last updated {formatTimestamp(order.settled_at ?? order.submitted_at ?? order.created_at)}
                </p>
                {canManage ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={syncing}
                    onClick={() => void handleSync()}
                  >
                    <RotateCcw className={cn("size-3.5", syncing && "animate-spin")} />
                    {syncing ? "Syncing…" : "Sync from provider"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <OrderPartiesCard order={order} />
          <OrderFactsCard order={order} />

          {failureSummary &&
          order.failure_code !== "payment_abandoned" &&
          (failureSummary.detail || order.failure_code || order.failure_reason) ? (
            <AdminFeedbackMessage
              variant="destructive"
              title={failureSummary.detail ? failureSummary.title : undefined}
            >
              {failureSummary.detail ?? failureSummary.title}
            </AdminFeedbackMessage>
          ) : null}

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-compact font-semibold text-foreground">What happened</p>
              <StatusBadge variant="neutral" showIcon={false} className="shrink-0 whitespace-nowrap">
                {journey?.steps.length ?? 0} step{(journey?.steps.length ?? 0) === 1 ? "" : "s"}
              </StatusBadge>
            </div>
            {journey?.outcomeSummary ? (
              <p className="mb-4 max-w-sm text-caption leading-relaxed text-muted-foreground">
                {journey.outcomeSummary}
              </p>
            ) : (
              <p className="mb-4 max-w-sm text-caption text-muted-foreground">
                Step-by-step status changes for this transaction.
              </p>
            )}
            {journey && journey.steps.length === 0 ? (
              <p className="text-compact text-muted-foreground">No status changes recorded yet.</p>
            ) : (
              <div>
                {journey?.steps.map((step, index) => (
                  <JourneyEventRow
                    key={`${step.event.created_at ?? "event"}-${index}`}
                    step={step}
                    isLast={index === journey.steps.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AdminDetailDialog>
  );
}
