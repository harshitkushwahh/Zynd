"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Building2, Check, Copy, Hash, Receipt } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { SupportFeedbackMessage } from "@/components/ui/support-feedback-message";
import type { DistributorOrder, OrderStatus } from "@/lib/distributor-types";
import { DISTRIBUTOR_OVERLAY_BODY_SCROLL_CLASS } from "@/lib/distributor-layout";
import { formatAum, formatDistributorDateTime } from "@/lib/format";
import { getDisplayInitials } from "@/lib/get-display-initials";
import { orderStatusVariant } from "@/lib/status-meta";
import {
  buildSupportTransactionDetail,
  formatSupportFriendlyToken,
  formatSupportTransactionStatus,
  type SupportTransactionJourneyStep,
} from "@/lib/support-transaction-detail-model";
import { cn } from "@/lib/utils";

type SupportTransactionDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DistributorOrder | null;
};

function journeyBadgeVariant(status: string, isTerminal?: boolean) {
  if (isTerminal) return "destructive" as const;
  const normalized = status.toLowerCase();
  if (normalized === "succeeded" || normalized === "active") return "success" as const;
  if (normalized === "failed" || normalized === "cancelled") return "destructive" as const;
  if (
    normalized === "payment_pending" ||
    normalized === "submitted" ||
    normalized === "processing" ||
    normalized === "pending"
  ) {
    return "warning" as const;
  }
  return "neutral" as const;
}

function providerBadgeVariant(status: OrderStatus) {
  if (status === "Failed") return "destructive" as const;
  if (status === "Completed") return "success" as const;
  if (status === "Pending" || status === "Processing") return "warning" as const;
  return "info" as const;
}

function SchemeLogo({ name }: { name: string }) {
  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border border-border bg-background"
      aria-hidden
    >
      <Building2 className="size-4 text-muted-foreground" />
      <span className="sr-only">{name}</span>
    </div>
  );
}

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

function OrderFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-tiny font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-compact text-foreground">{value}</p>
    </div>
  );
}

function JourneyEventRow({
  step,
  isLast,
}: {
  step: SupportTransactionJourneyStep;
  isLast: boolean;
}) {
  const isTerminal = step.isTerminal;

  return (
    <div className="flex gap-3">
      <div className="flex w-timeline-rail flex-col items-center self-stretch">
        <span
          className={cn(
            "relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full border",
            isTerminal ? "border-destructive/40 bg-destructive/10" : "border-border bg-card",
          )}
        >
          <span
            className={cn("size-2 rounded-full", isTerminal ? "bg-destructive" : "bg-primary")}
          />
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
      </div>
      <div
        className={cn(
          "mb-5 min-w-0 flex-1 rounded-[var(--radius-control)] border px-3 py-3",
          isTerminal ? "border-destructive/35 bg-destructive/5" : "border-border/70 bg-muted/10",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{step.title}</p>
          <StatusBadge
            variant={journeyBadgeVariant(step.toStatus, step.isTerminal)}
            showIcon
            className="normal-case"
          >
            {formatSupportFriendlyToken(step.toStatus)}
          </StatusBadge>
        </div>
        {step.description ? (
          <p className="mt-1.5 text-compact leading-relaxed text-muted-foreground">
            {step.description}
          </p>
        ) : null}
        <p className="mt-2 text-caption text-muted-foreground">
          {formatDistributorDateTime(step.timestamp)} · {step.actor}
        </p>
      </div>
    </div>
  );
}

export function SupportTransactionDetailDialog({
  open,
  onOpenChange,
  order,
}: SupportTransactionDetailDialogProps) {
  const detail = useMemo(
    () => (order ? buildSupportTransactionDetail(order) : null),
    [order],
  );

  if (!order || !detail) return null;

  const lastUpdated = detail.settledAt ?? detail.submittedAt ?? order.createdAt;
  const profileHref = `/dashboard/users/${encodeURIComponent(order.clientCode)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Transaction details</DialogTitle>
        <DialogDescription>
          Follow the order from placement through payment, allotment, and settlement.
        </DialogDescription>
      </DialogHeader>
      <DialogContent className="max-h-[min(92vh,52rem)] max-w-3xl gap-0 overflow-hidden p-0">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-info/25 bg-info/10 text-info"
            aria-hidden
          >
            <Receipt className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 pr-8">
            <DialogTitle className="text-compact font-semibold text-foreground">
              Transaction details
            </DialogTitle>
            <DialogDescription className="mt-1 text-caption">
              Follow the order from placement through payment, allotment, and settlement.
            </DialogDescription>
          </div>
        </div>

        <div className={cn(DISTRIBUTOR_OVERLAY_BODY_SCROLL_CLASS, "max-h-[calc(min(92vh,52rem)-5.5rem)] px-5 py-5")}>
          <div className="space-y-5">
            <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <SchemeLogo name={order.schemeName} />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{order.schemeName}</p>
                    <p className="mt-1 text-caption capitalize text-muted-foreground">
                      {order.orderType.toLowerCase()}
                      {detail.amcName ? ` · ${detail.amcName}` : ""}
                    </p>
                    <div className="mt-2">
                      <StatusBadge variant={orderStatusVariant(order.status)} showIcon className="normal-case">
                        {formatSupportTransactionStatus(order.status)}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="font-heading text-h4 font-semibold tabular-nums text-foreground">
                    {formatAum(order.amount)}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    Last updated {formatDistributorDateTime(lastUpdated)}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
              <div className="flex flex-col gap-3 border-b border-border bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-compact font-semibold text-foreground">Customer & references</p>
                <StatusBadge variant={providerBadgeVariant(order.status)}>
                  {detail.providerStatusLabel}
                </StatusBadge>
              </div>
              <div className="space-y-4 p-4">
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    {detail.profileImageUrl ? (
                      <AvatarImage src={detail.profileImageUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="text-caption font-medium">
                      {getDisplayInitials(detail.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Link
                      href={profileHref}
                      className="block truncate font-medium text-foreground hover:text-primary"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {detail.displayName}
                    </Link>
                    <p className="mt-0.5 truncate text-caption text-muted-foreground">
                      {detail.emailMasked} · {order.clientCode}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="mb-3 flex items-center gap-2 text-caption font-medium text-muted-foreground">
                    <Hash className="size-3.5" />
                    Transaction references
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <IdTile label="Purchase reference" value={detail.fpPurchaseId} />
                    <IdTile label="Checkout" value={detail.checkoutId} />
                    <IdTile label="Order ID" value={order.orderRef} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
              <p className="text-compact font-semibold text-foreground">Order facts</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <OrderFact
                  label="Payment method"
                  value={formatSupportFriendlyToken(detail.paymentMethod)}
                />
                <OrderFact label="Provider state" value={detail.providerState} />
                <OrderFact label="Next action" value={formatSupportFriendlyToken(detail.nextAction)} />
                <OrderFact label="Product ID" value={detail.productId} />
                <OrderFact label="Created" value={formatDistributorDateTime(order.createdAt)} />
                <OrderFact
                  label="Submitted"
                  value={detail.submittedAt ? formatDistributorDateTime(detail.submittedAt) : "—"}
                />
                <OrderFact
                  label="Settled"
                  value={detail.settledAt ? formatDistributorDateTime(detail.settledAt) : "—"}
                />
                <OrderFact
                  label="Payment link"
                  value={
                    detail.paymentUrl ? (
                      <span className="text-primary">Payment link on file</span>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
            </div>

            {detail.failureMessage && order.status === "Failed" ? (
              <SupportFeedbackMessage variant="error">{detail.failureMessage}</SupportFeedbackMessage>
            ) : null}

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-compact font-semibold text-foreground">What happened</p>
                <StatusBadge variant="neutral" showIcon={false} className="shrink-0 whitespace-nowrap">
                  {detail.journeySteps.length} step{detail.journeySteps.length === 1 ? "" : "s"}
                </StatusBadge>
              </div>
              {detail.outcomeSummary ? (
                <p className="mb-4 max-w-prose text-caption leading-relaxed text-muted-foreground">
                  {detail.outcomeSummary}
                </p>
              ) : (
                <p className="mb-4 max-w-prose text-caption text-muted-foreground">
                  Step-by-step status changes for this transaction.
                </p>
              )}
              <div>
                {detail.journeySteps.map((step, index) => (
                  <JourneyEventRow
                    key={step.id}
                    step={step}
                    isLast={index === detail.journeySteps.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
