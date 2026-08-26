"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { RiskProfileGauge } from "@/components/risk-profile/risk-profile-gauge";
import { RiskProfileTierBadge } from "@/components/risk-profile/risk-profile-tier-badge";
import { Button } from "@/components/ui/button";
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from "@/components/ui/admin-dialog";
import { formatTimestampDetail } from "@/lib/format-date";
import { downloadAdminRiskProfileReport } from "@/lib/risk-profile-pdf-download";
import type { UserRiskProfileAssessmentItem } from "@/lib/risk-profile-admin-api";
import { normalizeRiskScore, resolveRiskTierVisual } from "@/lib/risk-profile-gauge-ui";
import { cn } from "@/lib/utils";

type AdminUserRiskAssessmentQuickDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  item: UserRiskProfileAssessmentItem | null;
  onViewAnswers: () => void;
};

export function AdminUserRiskAssessmentQuickDialog({
  open,
  onOpenChange,
  userId,
  item,
  onViewAnswers,
}: AdminUserRiskAssessmentQuickDialogProps) {
  const [downloading, setDownloading] = useState(false);

  if (!item) return null;

  const tierVisual = resolveRiskTierVisual(item.tier);
  const displayScore = item.display_score ?? normalizeRiskScore(item.score);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAdminRiskProfileReport(userId, item.assessment_id);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent size="md">
        <AdminDialogHeader
          title={item.tier_config.title}
          description="Risk profile assessment summary"
        />
        <AdminDialogBody className="space-y-4 pt-0">
          <div className="admin-user-risk-quick-dialog__gauge-wrap">
            <RiskProfileGauge
              score={item.score}
              tier={item.tier}
              displayScore={displayScore}
              size="hero"
            />
            <p className={cn("admin-user-risk-quick-dialog__score tabular-nums", tierVisual.textClass)}>
              <span className="admin-user-risk-quick-dialog__score-value">{displayScore}</span>
              <span className="admin-user-risk-quick-dialog__score-denom">/100</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <RiskProfileTierBadge tier={item.tier} label={tierVisual.label} />
            {item.completed_at ? (
              <span className="admin-user-risk-quick-dialog__date">
                {formatTimestampDetail(item.completed_at)}
              </span>
            ) : null}
          </div>
          <dl className="admin-user-risk-quick-dialog__meta">
            <div>
              <dt>Raw score</dt>
              <dd>{item.score} / 1000</dd>
            </div>
            <div>
              <dt>Score band</dt>
              <dd>
                {item.tier_config.min_score}–{item.tier_config.max_score}
              </dd>
            </div>
            <div>
              <dt>Questions</dt>
              <dd>
                {item.questions_answered} / {item.total_questions}
              </dd>
            </div>
            <div>
              <dt>Assessment ID</dt>
              <dd className="font-mono">{item.assessment_id}</dd>
            </div>
          </dl>
          <p className="admin-user-risk-quick-dialog__message">{item.tier_config.message_body}</p>
        </AdminDialogBody>
        <AdminDialogFooter className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Download report
          </Button>
          <Button type="button" onClick={onViewAnswers}>
            View answers
          </Button>
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
}
