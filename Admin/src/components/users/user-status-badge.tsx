"use client";

import { Shield, UserRound } from "lucide-react";

import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";

function userStatusVariant(status: string): StatusBadgeVariant {
  if (status === "active") return "success";
  if (status === "suspended") return "destructive";
  if (status === "pending") return "warning";
  return "neutral";
}

export function UserStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge variant={userStatusVariant(status)}>
      {status.replaceAll("_", " ")}
    </StatusBadge>
  );
}

export function PlatformRoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";

  return (
    <StatusBadge variant={isAdmin ? "info" : "neutral"} icon={isAdmin ? Shield : UserRound}>
      {isAdmin ? "Admin" : "Customer"}
    </StatusBadge>
  );
}

export function InvestmentStatusBadge({ hasInvested }: { hasInvested: boolean }) {
  return (
    <StatusBadge variant={hasInvested ? "success" : "neutral"}>
      {hasInvested ? "Invested" : "Not invested"}
    </StatusBadge>
  );
}

export function MfaStatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <StatusBadge variant={enabled ? "success" : "neutral"}>
      {enabled ? "MFA enabled" : "MFA not enabled"}
    </StatusBadge>
  );
}

export function KycComplianceBadge({ compliant }: { compliant: boolean }) {
  return (
    <StatusBadge variant={compliant ? "success" : "neutral"}>
      {compliant ? "Compliant" : "Not compliant"}
    </StatusBadge>
  );
}

export { OrderStatusBadge, orderStatusVariant } from "@/components/mf/order-status-badge";

export function kycOverallStatusVariant(status: string): StatusBadgeVariant {
  if (status === "completed") return "success";
  if (status === "submitted") return "warning";
  if (status === "none") return "neutral";
  return "info";
}

export function kycStepStatusVariant(status: string): StatusBadgeVariant {
  if (["verified", "completed", "skipped"].includes(status)) return "success";
  if (status === "failed") return "destructive";
  if (status === "saved") return "info";
  return "neutral";
}

export function documentReviewStatusVariant(status: string): StatusBadgeVariant {
  const normalized = status.toLowerCase();
  if (normalized === "verified" || normalized === "approved") return "success";
  if (normalized === "rejected" || normalized === "failed") return "destructive";
  if (normalized === "pending" || normalized === "submitted") return "warning";
  return "neutral";
}
