"use client";

import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format-date";

import { AmcLogo } from "@/components/mf/amc-logo";
import { MfOrderCustomerCell } from "@/components/mf/mf-order-journey-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";
import { OrderStatusBadge } from "@/components/users/user-status-badge";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfTransactionCheckoutDetail,
  type MfTransactionCheckout,
} from "@/lib/mf-transactions-admin-api";



export function MfTransactionCheckoutDetailDialog({
  open,
  checkoutId,
  onClose,
}: {
  open: boolean;
  checkoutId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<MfTransactionCheckout | null>(null);

  useEffect(() => {
    if (!open || !checkoutId) {
      setDetail(null);
      setError("");
      return;
    }

    const loadDetail = async () => {
      setLoading(true);
      setError("");
      try {
        setDetail(await fetchMfTransactionCheckoutDetail(checkoutId));
      } catch (err) {
        setError(getErrorMessage(err, "Could not load bulk order details."));
        setDetail(null);
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [checkoutId, open]);

  return (
    <AdminDetailDialog
      open={open && Boolean(checkoutId)}
      onClose={onClose}
      title="Bulk order details"
      icon={ShoppingCart}
      iconTone="info"
    >
      <div className="space-y-5">
        {loading ? (
          <AdminDetailDialogSkeleton />
        ) : error ? (
          <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>
        ) : detail ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-caption text-muted-foreground">Customer</p>
                <div className="mt-1">
                  <MfOrderCustomerCell
                    order={{
                      order_id: detail.checkout_id,
                      status: detail.status,
                      amount_inr: detail.total_amount_inr,
                      user_display_name: detail.user_display_name,
                      user_email: detail.user_email,
                      user_profile_image_url: detail.user_profile_image_url,
                      client_id: detail.client_id,
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">Checkout status</p>
                <div className="mt-1">
                  <OrderStatusBadge status={detail.status} />
                </div>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">Total amount</p>
                <p className="mt-1 font-medium tabular-nums">
                  ₹{detail.total_amount_inr.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">Products</p>
                <p className="mt-1 font-medium">
                  {detail.order_count} fund{detail.order_count === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">Created</p>
                <p className="mt-1 text-body">{formatTimestamp(detail.created_at)}</p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">Updated</p>
                <p className="mt-1 text-body">{formatTimestamp(detail.updated_at)}</p>
              </div>
            </div>

            {detail.next_action ? (
              <div className="rounded-card border border-border bg-muted/30 px-4 py-3">
                <p className="text-caption text-muted-foreground">Next action</p>
                <p className="mt-1 text-body">{detail.next_action}</p>
              </div>
            ) : null}

            <Separator />

            <div className="space-y-3">
              <h3 className="font-heading text-body font-semibold text-foreground">Line items</h3>
              <div className="space-y-2">
                {detail.orders.map((order, index) => (
                  <div
                    key={order.order_id}
                    className="flex flex-col gap-2 rounded-card border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AmcLogo
                        name={order.product_name ?? `Fund ${index + 1}`}
                        logoUrl={order.amc_logo_url}
                        className="size-8"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {order.product_name ?? `Fund ${index + 1}`}
                        </p>
                        <p className="text-caption text-muted-foreground capitalize">
                          {(order.order_type ?? "lumpsum").toLowerCase()} · Line {order.line_index ?? index}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} />
                      <p className="font-medium tabular-nums">₹{order.amount_inr.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminDetailDialog>
  );
}
