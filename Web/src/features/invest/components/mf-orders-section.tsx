"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldMessage } from "@/components/ui/ui-message";
import { fetchMfOrders, type MfOrder } from "@/features/invest/api/invest-api";
import { formatDate, formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";

function OrderRow({ order }: { order: MfOrder }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {order.product_name ?? copy.mutualFunds.unknownFund}
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          {order.order_type.replaceAll("_", " ")} · {formatDate(order.created_at)}
        </p>
      </div>
      <div className="flex items-center gap-4 sm:text-right">
        <div>
          <p className="font-medium">{formatInr(order.amount_inr)}</p>
          <p className="text-caption capitalize text-muted-foreground">
            {order.status.replaceAll("_", " ")}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MfOrdersSection() {
  const [orders, setOrders] = useState<MfOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMfOrders()
      .then((response) => {
        if (!cancelled) setOrders(response.orders);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || copy.mutualFunds.ordersLoadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{copy.mutualFunds.ordersTitle}</CardTitle>
          <CardDescription>{copy.mutualFunds.ordersDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {copy.mutualFunds.loadingOrders}
            </div>
          ) : null}
          {error ? <FieldMessage variant="error" message={error} /> : null}
          {!loading && !error && orders.length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6 text-center">
              <p className="text-compact text-muted-foreground">{copy.mutualFunds.ordersEmpty}</p>
            </div>
          ) : null}
          {orders.map((order) => (
            <OrderRow key={order.order_id} order={order} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
