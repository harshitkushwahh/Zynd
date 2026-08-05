"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminUserKycComplianceIssue } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

type AdminUserKycCompliancePanelProps = {
  issues: AdminUserKycComplianceIssue[];
  className?: string;
};

function severityVariant(severity: string): "destructive" | "warning" | "neutral" {
  if (severity === "high") return "destructive";
  if (severity === "medium") return "warning";
  return "neutral";
}

export function AdminUserKycCompliancePanel({
  issues,
  className,
}: AdminUserKycCompliancePanelProps) {
  const openIssues = issues.filter((issue) => issue.status === "open");

  return (
    <section className={cn("admin-user-kyc-compliance", className)}>
      {openIssues.length === 0 ? (
        <div className="admin-user-kyc-compliance__empty">
          <CheckCircle2 className="size-5 text-success" aria-hidden />
          <p className="mt-2 text-compact font-medium text-foreground">No open compliance issues</p>
          <p className="mt-1 text-caption text-muted-foreground">
            The investor journey has no recorded failures or blockers.
          </p>
        </div>
      ) : (
        <ul className="admin-user-kyc-compliance__list">
          {openIssues.map((issue) => (
            <li key={issue.id} className="admin-user-kyc-compliance__item">
              <div className="admin-user-kyc-compliance__item-icon" aria-hidden>
                <AlertTriangle className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{issue.title}</p>
                  <StatusBadge variant={severityVariant(issue.severity)} showIcon={false}>
                    {issue.step_label}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-caption text-muted-foreground">{issue.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
