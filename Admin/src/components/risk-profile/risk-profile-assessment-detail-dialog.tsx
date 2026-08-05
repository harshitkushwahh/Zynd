"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";

import { RiskProfileUserCell, type RiskProfileUserSummary } from "@/components/risk-profile/risk-profile-user-cell";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format-date";
import { downloadAdminRiskProfileReport } from "@/lib/risk-profile-pdf-download";
import {
  fetchUserRiskProfileAssessmentDetail,
  type UserRiskProfileAssessmentDetail,
} from "@/lib/risk-profile-admin-api";
import { cn } from "@/lib/utils";

function tierBadgeVariant(tier: string) {
  if (tier === "aggressive" || tier === "growth") return "warning" as const;
  if (tier === "secure" || tier === "conservative") return "info" as const;
  return "success" as const;
}

function AnswerOptionsList({
  answer,
}: {
  answer: UserRiskProfileAssessmentDetail["answers"][number];
}) {
  if (!answer.options.length) {
    return <p className="mt-2 text-compact text-primary">{answer.selected_option_label}</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-caption font-medium text-muted-foreground">Options</p>
      {answer.options.map((option, optionIndex) => (
        <div
          key={option.id}
          className={cn(
            "flex items-center justify-between gap-3 rounded-[var(--radius-control)] border px-3 py-2.5",
            option.selected ? "border-primary/30 bg-primary/5" : "border-border/70 bg-muted/10",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-tiny font-semibold",
                option.selected
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {optionIndex + 1}
            </span>
            <span
              className={cn(
                "text-compact",
                option.selected ? "font-medium text-primary" : "text-foreground",
              )}
            >
              {option.label}
            </span>
          </div>
          {option.score_value != null ? (
            <span
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-tiny font-semibold tabular-nums",
                option.selected
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {option.score_value}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function AssessmentDetailBody({
  detail,
  user,
}: {
  detail: UserRiskProfileAssessmentDetail;
  user: RiskProfileUserSummary | null;
}) {
  return (
    <div className="space-y-5">
      {user ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
          <RiskProfileUserCell user={user} />
        </div>
      ) : null}

      <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">{detail.tier_config.title}</p>
            <p className="mt-1 text-caption capitalize text-muted-foreground">{detail.tier}</p>
          </div>
          <StatusBadge variant={tierBadgeVariant(detail.tier)} showIcon={false} className="normal-case">
            {detail.display_score}/100
          </StatusBadge>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-caption text-muted-foreground">Raw score</dt>
            <dd className="text-compact font-medium text-foreground">{detail.score} / 1000</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Questions answered</dt>
            <dd className="text-compact font-medium text-foreground">{detail.questions_answered}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Completed</dt>
            <dd className="text-compact text-foreground">{formatTimestamp(detail.completed_at)}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Score band</dt>
            <dd className="text-compact font-medium text-foreground">
              {detail.tier_config.min_score}–{detail.tier_config.max_score}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3">
        <p className="text-compact font-semibold text-foreground">How the score was calculated</p>
        <p className="text-compact leading-relaxed text-muted-foreground">{detail.scoring.formula_summary}</p>
        <div className="overflow-hidden rounded-[var(--radius-control)] border border-border">
          <table className="w-full text-left text-compact">
            <thead className="bg-muted/20 text-caption text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium text-right">Weight</th>
                <th className="px-3 py-2 font-medium text-right">Category score</th>
                <th className="px-3 py-2 font-medium text-right">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {detail.scoring.categories.map((category) => (
                <tr key={category.category_id} className="border-t border-border/70">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{category.category_name}</p>
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      {category.questions_answered} question{category.questions_answered === 1 ? "" : "s"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {(category.weight * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {category.normalized_score.toFixed(0)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {category.weighted_contribution.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-muted-foreground">
          Final weighted score: {detail.scoring.final_score} / 1000
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-compact font-semibold text-foreground">Answers</p>
        <div className="space-y-2">
          {detail.answers.map((answer, index) => (
            <div
              key={answer.question_id}
              className="rounded-[var(--radius-control)] border border-border bg-card px-3 py-3"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    "bg-muted text-tiny font-semibold text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-caption text-muted-foreground">{answer.category_name ?? "Category"}</p>
                  <p className="mt-1 text-compact font-medium text-foreground">{answer.prompt}</p>
                  {answer.help_text ? (
                    <p className="mt-1 text-caption text-muted-foreground">{answer.help_text}</p>
                  ) : null}
                  <AnswerOptionsList answer={answer} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RiskProfileAssessmentDetailDialog({
  open,
  user,
  userId,
  assessmentId,
  onClose,
}: {
  open: boolean;
  user?: RiskProfileUserSummary | null;
  userId: string | null;
  assessmentId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<UserRiskProfileAssessmentDetail | null>(null);

  useEffect(() => {
    if (!open || !userId || !assessmentId) {
      setDetail(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void fetchUserRiskProfileAssessmentDetail(userId, assessmentId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, "Could not load risk profile report."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId, assessmentId]);

  if (!open || !userId || !assessmentId) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAdminRiskProfileReport(userId, assessmentId);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AdminDetailDialog
      open={open}
      onClose={onClose}
      title="Risk profile report"
      description="Assessment answers, category weights, and score breakdown."
      icon={FileText}
      iconTone="info"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => void handleDownload()} disabled={downloading || loading || !detail}>
            <Download className="size-4" />
            Download report
          </Button>
        </div>
      }
    >
      {loading ? (
        <AdminDetailDialogSkeleton />
      ) : error ? (
        <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>
      ) : detail ? (
        <AssessmentDetailBody detail={detail} user={user ?? null} />
      ) : null}
    </AdminDetailDialog>
  );
}
