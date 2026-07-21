"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Files, Gauge, History } from "lucide-react";

import { RiskProfileAssessmentDetailDialog } from "@/components/risk-profile/risk-profile-assessment-detail-dialog";
import { RiskProfileUserCell } from "@/components/risk-profile/risk-profile-user-cell";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestampDetail } from "@/lib/format-date";
import { resolveRiskTierBadgeVariant } from "@/lib/risk-tier-admin-ui";
import {
  fetchUserRiskProfileAssessments,
  type UserRiskProfileAssessmentItem,
  type UserRiskProfileItem,
} from "@/lib/risk-profile-admin-api";
import { cn } from "@/lib/utils";

function UserReportsSummary({
  user,
  items,
}: {
  user: UserRiskProfileItem;
  items: UserRiskProfileAssessmentItem[];
}) {
  const latest = items[0];

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border bg-muted/15 px-4 py-3">
        <RiskProfileUserCell user={user} />
      </div>
      <dl className="grid gap-px bg-border sm:grid-cols-3">
        <div className="bg-card px-4 py-3">
          <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <History className="size-3.5 shrink-0" aria-hidden />
            Reports
          </dt>
          <dd className="mt-1 text-compact font-semibold tabular-nums text-foreground">
            {items.length || user.assessment_count}
          </dd>
        </div>
        <div className="bg-card px-4 py-3">
          <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <Gauge className="size-3.5 shrink-0" aria-hidden />
            Latest score
          </dt>
          <dd className="mt-1 text-compact font-semibold tabular-nums text-foreground">
            {latest ? `${latest.display_score}/100` : `${Math.round(user.score / 10)}/100`}
          </dd>
        </div>
        <div className="bg-card px-4 py-3">
          <dt className="text-caption text-muted-foreground">Latest tier</dt>
          <dd className="mt-1.5">
            <StatusBadge
              variant={resolveRiskTierBadgeVariant(latest?.tier ?? user.tier)}
              showIcon={false}
              className="normal-case capitalize"
            >
              {latest?.tier_config.title ?? user.tier}
            </StatusBadge>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ReportHistoryRow({
  item,
  index,
  isLast,
  isLatest,
  onSelect,
}: {
  item: UserRiskProfileAssessmentItem;
  index: number;
  isLast: boolean;
  isLatest: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex w-timeline-rail flex-col items-center self-stretch pt-1">
        <span
          className={cn(
            "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-tiny font-semibold",
            isLatest ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground",
          )}
        >
          {index + 1}
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
      </div>

      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group mb-4 min-w-0 flex-1 rounded-[var(--radius-control)] border px-3 py-3 text-left transition-colors",
          isLatest
            ? "border-primary/25 bg-primary/5 hover:bg-primary/10"
            : "border-border/70 bg-muted/10 hover:bg-muted/20",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{item.tier_config.title}</p>
              {isLatest ? (
                <Badge variant="secondary" className="h-5 px-1.5 text-micro font-medium">
                  Latest
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              {item.completed_at ? formatTimestampDetail(item.completed_at) : "No date"}
              {" · "}
              {item.questions_answered} question{item.questions_answered === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <StatusBadge
                variant={resolveRiskTierBadgeVariant(item.tier)}
                showIcon={false}
                className="normal-case tabular-nums"
              >
                {item.display_score}/100
              </StatusBadge>
              <p className="mt-1 text-micro tabular-nums text-muted-foreground">{item.score}/1000</p>
            </div>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
              aria-hidden
            />
          </div>
        </div>
      </button>
    </div>
  );
}

export function RiskProfileUserReportsDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: UserRiskProfileItem | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<UserRiskProfileAssessmentItem[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) {
      setItems([]);
      setError("");
      setSelectedAssessmentId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void fetchUserRiskProfileAssessments(user.user_id)
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, "Could not load risk profile reports."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const reportCount = useMemo(() => items.length || user?.assessment_count || 0, [items.length, user?.assessment_count]);

  if (!open || !user) return null;

  return (
    <>
      <AdminDetailDialog
        open={open}
        onClose={onClose}
        title="Risk profile reports"
        description="Completed assessments newest first. Select a report to view answers and scoring."
        icon={Files}
        iconTone="info"
      >
        {loading ? (
          <AdminDetailDialogSkeleton />
        ) : error ? (
          <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>
        ) : (
          <div className="space-y-5">
            <UserReportsSummary user={user} items={items} />

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-compact font-semibold text-foreground">Assessment history</p>
                <StatusBadge variant="neutral" showIcon={false} className="shrink-0 whitespace-nowrap">
                  {reportCount} report{reportCount === 1 ? "" : "s"}
                </StatusBadge>
              </div>

              {items.length === 0 ? (
                <p className="text-compact text-muted-foreground">No reports found for this user.</p>
              ) : (
                <div>
                  {items.map((item, index) => (
                    <ReportHistoryRow
                      key={item.assessment_id}
                      item={item}
                      index={index}
                      isLast={index === items.length - 1}
                      isLatest={index === 0}
                      onSelect={() => setSelectedAssessmentId(item.assessment_id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AdminDetailDialog>

      <RiskProfileAssessmentDetailDialog
        open={Boolean(selectedAssessmentId)}
        user={user}
        userId={user.user_id}
        assessmentId={selectedAssessmentId}
        onClose={() => setSelectedAssessmentId(null)}
      />
    </>
  );
}
