"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorOrder } from "@/lib/dummy/types";
import { formatAum, formatDistributorDate, formatDistributorDateTime } from "@/lib/format";
import {
  DISTRIBUTOR_INSET_SECTION_BODY_CLASS,
  DISTRIBUTOR_LABEL_CAPS_TINY_CLASS,
  DISTRIBUTOR_OVERLAY_HEADER_CLASS,
  DISTRIBUTOR_STACK_MD_CLASS,
} from "@/lib/distributor-layout";
import { orderStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

type ClientOrderDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DistributorOrder | null;
};

export function ClientOrderDetailDialog({ open, onOpenChange, order }: ClientOrderDetailDialogProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.activity;

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{copy.orderDetailTitle}</DialogTitle>
        <DialogDescription>{order.orderRef}</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className={DISTRIBUTOR_OVERLAY_HEADER_CLASS}>
          <h2 className="text-compact font-semibold">{copy.orderDetailTitle}</h2>
          <p className="distributor-panel-card__description font-mono text-caption">{order.orderRef}</p>
        </div>
        <div className={cn(DISTRIBUTOR_INSET_SECTION_BODY_CLASS, DISTRIBUTOR_STACK_MD_CLASS)}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={orderStatusVariant(order.status)}>{order.status}</StatusBadge>
            <span className="text-caption text-muted-foreground">{order.orderType}</span>
          </div>
          <p className="text-compact font-medium">{order.schemeName}</p>
          <dl className="distributor-client-order-detail-dialog__meta">
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{copy.orderDetailAmount}</dt>
              <dd className="mt-0.5 text-compact font-semibold tabular-nums">{formatAum(order.amount)}</dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{copy.orderDetailChannel}</dt>
              <dd className="mt-0.5 text-compact font-medium capitalize">{order.operationChannel}</dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{copy.orderDetailCreated}</dt>
              <dd className="mt-0.5 text-compact font-medium">{formatDistributorDateTime(order.createdAt)}</dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{copy.orderDetailSettled}</dt>
              <dd className="mt-0.5 text-compact font-medium">{formatDistributorDate(order.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}
