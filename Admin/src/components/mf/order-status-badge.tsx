"use client";

import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";

export function orderStatusVariant(status: string): StatusBadgeVariant {
  const normalized = status.toUpperCase();
  if (normalized === "SUCCEEDED" || normalized === "ACTIVE" || normalized === "COMPLETED") {
    return "success";
  }
  if (
    normalized === "FAILED" ||
    normalized === "CANCELLED" ||
    normalized === "REJECTED"
  ) {
    return "destructive";
  }
  if (normalized === "PENDING" || normalized === "PROCESSING" || normalized === "PAYMENT_PENDING") {
    return "warning";
  }
  if (normalized === "SUBMITTED") {
    return "info";
  }
  return "neutral";
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge variant={orderStatusVariant(status)} className="normal-case">
      {status.replaceAll("_", " ")}
    </StatusBadge>
  );
}
