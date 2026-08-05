"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Download, Eye, Loader2 } from "lucide-react";

import { AdminUserRiskMetaCopyBadge } from "@/components/users/admin-user-risk-meta-copy-badge";
import { AdminUserRiskAssessmentQuickDialog } from "@/components/users/admin-user-risk-assessment-quick-dialog";
import { RiskProfileAssessmentDetailDialog } from "@/components/risk-profile/risk-profile-assessment-detail-dialog";
import { RiskProfileGauge } from "@/components/risk-profile/risk-profile-gauge";
import { RiskProfileTierBadge } from "@/components/risk-profile/risk-profile-tier-badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatTimestampDetail } from "@/lib/format-date";
import { downloadAdminRiskProfileReport } from "@/lib/risk-profile-pdf-download";
import type {
  UserRiskProfileAssessmentItem,
  UserRiskProfileDetail,
} from "@/lib/risk-profile-admin-api";
import { normalizeRiskScore, resolveRiskTierVisual } from "@/lib/risk-profile-gauge-ui";
import { resolveRiskTierBadgeVariant } from "@/lib/risk-tier-admin-ui";
import { cn } from "@/lib/utils";

function CurrentRiskProfileCard({
  profile,
  current,
  userId,
  onViewDetails,
}: {
  profile: UserRiskProfileDetail;
  current: UserRiskProfileAssessmentItem;
  userId: string;
  onViewDetails: () => void;
}) {
  const tierVisual = resolveRiskTierVisual(profile.tier);
  const displayScore = current.display_score ?? normalizeRiskScore(profile.score);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAdminRiskProfileReport(userId, profile.assessment_id);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="admin-user-risk-current-card">
      <div className="admin-user-risk-current-card__gauge-block">
        <RiskProfileGauge
          score={profile.score}
          tier={profile.tier}
          displayScore={displayScore}
          size="hero"
          className="admin-user-risk-current-card__gauge"
        />
        <p className={cn("admin-user-risk-current-card__score tabular-nums", tierVisual.textClass)}>
          <span className="admin-user-risk-current-card__score-value">{displayScore}</span>
          <span className="admin-user-risk-current-card__score-denom">/100</span>
        </p>
        <RiskProfileTierBadge
          tier={profile.tier}
          label={profile.tier_config.title}
          className="admin-user-risk-current-card__tier-badge"
        />
      </div>
      <div className="admin-user-risk-current-card__body">
        <p className="admin-user-risk-current-card__message">{profile.tier_config.message_body}</p>
        <dl className="admin-user-risk-current-card__meta">
          <div>
            <dt>Score</dt>
            <dd>{profile.score} / 1000</dd>
          </div>
          <div>
            <dt>Score band</dt>
            <dd>
              {profile.tier_config.min_score}–{profile.tier_config.max_score}
            </dd>
          </div>
        </dl>
        <div className="admin-user-risk-current-card__copy-badges">
          <AdminUserRiskMetaCopyBadge
            label="Computed"
            value={profile.computed_at ? formatTimestampDetail(profile.computed_at) : "—"}
            copyValue={profile.computed_at ?? undefined}
          />
          <AdminUserRiskMetaCopyBadge
            label="Assessment ID"
            value={profile.assessment_id}
            mono
          />
        </div>
        <div className="admin-user-risk-current-card__actions">
          <Button type="button" size="sm" onClick={onViewDetails}>
            <Eye className="size-3.5" aria-hidden />
            View details
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
            Download report
          </Button>
        </div>
      </div>
    </article>
  );
}

function PastAssessmentRow({
  item,
  onSelect,
}: {
  item: UserRiskProfileAssessmentItem;
  onSelect: () => void;
}) {
  const tierVisual = resolveRiskTierVisual(item.tier);
  const displayScore = item.display_score ?? normalizeRiskScore(item.score);

  return (
    <tr className="admin-user-risk-assessments-table__row">
      <td className="admin-user-risk-assessments-table__gauge-cell">
        <button type="button" className="admin-user-risk-assessments-table__row-button" onClick={onSelect}>
          <RiskProfileGauge
            score={item.score}
            tier={item.tier}
            displayScore={displayScore}
            size="mini"
          />
        </button>
      </td>
      <td>
        <button type="button" className="admin-user-risk-assessments-table__row-button" onClick={onSelect}>
          <div className="admin-user-risk-assessments-table__row-main">
            <div className="admin-user-risk-assessments-table__row-copy">
              <div className="admin-user-risk-assessments-table__title-row">
                <p className="admin-user-risk-assessments-table__title">{item.tier_config.title}</p>
              </div>
              <p className="admin-user-risk-assessments-table__subtitle">
                {item.completed_at ? formatTimestampDetail(item.completed_at) : "—"}
                {" · "}
                {item.questions_answered} question{item.questions_answered === 1 ? "" : "s"}
              </p>
            </div>
            <div className="admin-user-risk-assessments-table__row-metrics">
              <StatusBadge
                variant={resolveRiskTierBadgeVariant(item.tier)}
                showIcon={false}
                className="normal-case tabular-nums"
              >
                {displayScore}/100
              </StatusBadge>
              <p className={cn("admin-user-risk-assessments-table__raw-score tabular-nums", tierVisual.textClass)}>
                {item.score}/1000
              </p>
              <ChevronRight className="admin-user-risk-assessments-table__chevron" aria-hidden />
            </div>
          </div>
        </button>
      </td>
    </tr>
  );
}

function PastAssessmentsTable({
  items,
  currentAssessmentId,
  onSelect,
}: {
  items: UserRiskProfileAssessmentItem[];
  currentAssessmentId: string;
  onSelect: (item: UserRiskProfileAssessmentItem) => void;
}) {
  const pastItems = useMemo(
    () => items.filter((item) => item.assessment_id !== currentAssessmentId),
    [items, currentAssessmentId],
  );

  if (pastItems.length === 0) {
    return (
      <section className="admin-user-risk-assessments-table admin-user-risk-assessments-table--empty">
        <header className="admin-user-risk-assessments-table__header">
          <h3 className="admin-user-risk-assessments-table__heading">Past assessments</h3>
        </header>
        <p className="admin-user-risk-assessments-table__empty">No prior assessments on record.</p>
      </section>
    );
  }

  return (
    <section className="admin-user-risk-assessments-table">
      <header className="admin-user-risk-assessments-table__header">
        <h3 className="admin-user-risk-assessments-table__heading">Past assessments</h3>
        <StatusBadge variant="neutral" showIcon={false}>
          {pastItems.length}
        </StatusBadge>
      </header>
      <div className="admin-user-risk-assessments-table__scroll">
        <table className="admin-user-risk-assessments-table__table">
          <tbody>
            {pastItems.map((item) => (
              <PastAssessmentRow
                key={item.assessment_id}
                item={item}
                onSelect={() => onSelect(item)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type AdminUserRiskProfileLayoutProps = {
  userId: string;
  profile: UserRiskProfileDetail;
  assessments: UserRiskProfileAssessmentItem[];
};

export function AdminUserRiskProfileLayout({
  userId,
  profile,
  assessments,
}: AdminUserRiskProfileLayoutProps) {
  const current = useMemo(
    () =>
      assessments.find((item) => item.assessment_id === profile.assessment_id) ??
      assessments[0] ??
      null,
    [assessments, profile.assessment_id],
  );

  const [quickItem, setQuickItem] = useState<UserRiskProfileAssessmentItem | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);
  const [answersAssessmentId, setAnswersAssessmentId] = useState<string | null>(null);

  const openQuick = (item: UserRiskProfileAssessmentItem) => {
    setQuickItem(item);
    setQuickOpen(true);
  };

  const openAnswers = (assessmentId: string) => {
    setQuickOpen(false);
    setAnswersAssessmentId(assessmentId);
    setAnswersOpen(true);
  };

  if (!current) {
    return null;
  }

  return (
    <>
      <div className="admin-user-risk-profile-layout">
        <CurrentRiskProfileCard
          profile={profile}
          current={current}
          userId={userId}
          onViewDetails={() => openQuick(current)}
        />
        <PastAssessmentsTable
          items={assessments}
          currentAssessmentId={profile.assessment_id}
          onSelect={openQuick}
        />
      </div>

      <AdminUserRiskAssessmentQuickDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        userId={userId}
        item={quickItem}
        onViewAnswers={() => {
          if (quickItem) openAnswers(quickItem.assessment_id);
        }}
      />

      <RiskProfileAssessmentDetailDialog
        open={answersOpen}
        userId={userId}
        assessmentId={answersAssessmentId}
        onClose={() => {
          setAnswersOpen(false);
          setAnswersAssessmentId(null);
        }}
      />
    </>
  );
}
