"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldMessage } from "@/components/ui/ui-message";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMfOrders, type MfOrder } from "@/features/invest/api/invest-api";
import { MfOrderStatusBadge } from "@/features/invest/components/mf-order-status-badge";
import { MfOrderJourneyDialog } from "@/features/invest/components/payment-dialog";
import { formatDate, formatInr } from "@/features/invest/lib/mf-format";
import { sortMfTransactions } from "@/features/invest/lib/mf-transaction-filters";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;

function formatOrderType(orderType: string) {
  const normalized = orderType.trim().toUpperCase();
  if (normalized === "LUMPSUM") return copy.transactions.typeLumpsum;
  if (normalized === "SIP") return copy.transactions.typeSip;
  if (normalized === "REDEMPTION") return copy.transactions.typeRedemption;
  return orderType.replaceAll("_", " ");
}

function RecentTransactionRow({
  order,
  onClick,
}: {
  order: MfOrder;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-2 border-b border-border/60 py-4 text-left last:border-b-0",
        "transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {order.product_name ?? copy.mutualFunds.unknownFund}
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          {formatOrderType(order.order_type)} · {formatDate(order.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:text-right">
        <p className="font-medium text-foreground">{formatInr(order.amount_inr)}</p>
        <MfOrderStatusBadge status={order.status} />
      </div>
    </button>
  );
}

function RecentTransactionsSkeleton() {
  return (
    <div className="space-y-4 py-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OverviewRecentTransactions() {
  const { overview } = copy.dashboard;
  const [orders, setOrders] = useState<MfOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [journeyOpen, setJourneyOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchMfOrders(PREVIEW_LIMIT)
      .then((response) => {
        if (!cancelled) setOrders(response.orders);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || overview.recentTransactionsLoadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [overview.recentTransactionsLoadError]);

  const recentOrders = useMemo(
    () => sortMfTransactions(orders).slice(0, PREVIEW_LIMIT),
    [orders],
  );

  useEffect(() => {
    if (journeyOpen) return;

    const timer = window.setTimeout(() => {
      setSelectedOrderId(null);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [journeyOpen]);

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="min-w-0">
            <CardTitle>{overview.recentTransactionsTitle}</CardTitle>
            <CardDescription>{overview.recentTransactionsDescription}</CardDescription>
          </div>
          {!loading && !error && recentOrders.length > 0 ? (
            <Link
              href="/dashboard/transactions"
              className="inline-flex shrink-0 items-center gap-1 text-caption font-medium text-primary hover:underline"
            >
              {overview.recentTransactionsViewAll}
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? <RecentTransactionsSkeleton /> : null}
          {error ? <FieldMessage variant="error" message={error} /> : null}
          {!loading && !error && recentOrders.length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6 text-center">
              <p className="text-compact text-muted-foreground">
                {overview.recentTransactionsEmpty}
              </p>
            </div>
          ) : null}
          {!loading && !error && recentOrders.length > 0 ? (
            <div>
              {recentOrders.map((order) => (
                <RecentTransactionRow
                  key={order.order_id}
                  order={order}
                  onClick={() => {
                    setSelectedOrderId(order.order_id);
                    setJourneyOpen(true);
                  }}
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <MfOrderJourneyDialog
        open={journeyOpen}
        orderId={selectedOrderId}
        onOpenChange={setJourneyOpen}
      />
    </>
  );
}
