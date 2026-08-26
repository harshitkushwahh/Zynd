"use client";

import Link from "next/link";
import { Coins, Gift, MousePointerClick, TrendingUp, UserPlus } from "lucide-react";

import { AdminUserProfileSectionEmptyState } from "@/components/users/admin-user-profile-section-empty-state";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminTableSkeleton } from "@/components/ui/admin-skeletons";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAdminUserReferralsQuery } from "@/hooks/use-admin-user-referrals-query";
import { userDashboardProfileHref } from "@/lib/admin-user-ref";
import {
  formatReferralInr,
  REFERRAL_STAGE_LABELS,
  referralProgressStep,
  type AdminReferralAttribution,
} from "@/lib/referrals-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";
import { PROFILE_SECTION_TITLE_CLASS } from "@/components/users/user-profile-typography";

type UserReferralsDetailSectionProps = {
  userId: string;
};

const PROGRESS_LABELS = ["Onboarded", "KYC completed", "Capital invested"] as const;

function ReferralProgressSteps({ stage }: { stage: AdminReferralAttribution["current_stage"] }) {
  const step = referralProgressStep(stage);
  return (
    <div className="flex flex-wrap gap-2">
      {PROGRESS_LABELS.map((label, index) => {
        const complete = index + 1 <= step;
        return (
          <span
            key={label}
            className={
              complete
                ? "rounded-full bg-primary/10 px-2.5 py-1 text-caption font-medium text-primary"
                : "rounded-full bg-muted px-2.5 py-1 text-caption text-muted-foreground"
            }
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

export function UserReferralsDetailSection({ userId }: UserReferralsDetailSectionProps) {
  const { data, isPending, error: queryError } = useAdminUserReferralsQuery(userId);
  const showSkeleton = isPending && !data;
  const error = queryError ? getErrorMessage(queryError, "Could not load referral activity.") : "";

  if (showSkeleton) {
    return <AdminTableSkeleton columns={5} rows={4} minWidth="lg" />;
  }

  if (error) {
    return <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>;
  }

  if (!data) return null;

  const hasReferralActivity =
    Boolean(data.referral_code) ||
    data.referrals.length > 0 ||
    Boolean(data.referred_by) ||
    data.click_count > 0;

  if (!hasReferralActivity) {
    return (
      <AdminUserProfileSectionEmptyState
        icon={Gift}
        title="No referral activity"
        description="This user has not referred anyone and was not referred by another user."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={PROFILE_SECTION_TITLE_CLASS}>Referral program</h2>
        <p className="mt-1 text-compact text-muted-foreground">
          Track who this user invited, their referral code activity, and whether they joined through
          someone else.
        </p>
      </div>

      <AdminMetricCardsGrid columns="four">
        <AdminMetricCard label="Link clicks" value={data.click_count} icon={MousePointerClick} />
        <AdminMetricCard label="Signups" value={data.counts.signup_count} icon={UserPlus} />
        <AdminMetricCard
          label="Invested referrals"
          value={data.counts.first_investment_count}
          icon={TrendingUp}
        />
        <AdminMetricCard
          label="Est. earnings"
          value={formatReferralInr(data.total_estimated_earnings_inr)}
          icon={Coins}
        />
      </AdminMetricCardsGrid>

      {data.referral_code ? (
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-caption font-medium text-muted-foreground">Referral code</p>
          <p className="mt-1 font-mono text-compact font-semibold text-foreground">{data.referral_code}</p>
          {data.share_url ? (
            <p className="mt-2 break-all text-caption text-muted-foreground">{data.share_url}</p>
          ) : null}
        </div>
      ) : null}

      {data.referred_by ? (
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="text-compact font-medium text-foreground">Referred by</p>
          <div className="mt-3 space-y-2">
            {data.referred_by.referrer ? (
              <Link
                href={userDashboardProfileHref(data.referred_by.referrer.client_id, "referrals")}
                className="font-medium text-primary hover:underline"
              >
                {data.referred_by.referrer.display_name}
              </Link>
            ) : null}
            <StatusBadge variant="info">
              {REFERRAL_STAGE_LABELS[data.referred_by.current_stage]}
            </StatusBadge>
            <ReferralProgressSteps stage={data.referred_by.current_stage} />
            <p className="text-caption text-muted-foreground">
              Signed up {formatTimestampDetail(data.referred_by.signed_up_at)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-compact font-semibold text-foreground">People referred</h3>
        <AdminDataTable minWidth="lg">
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Referee</AdminTableHeadCell>
              <AdminTableHeadCell>Stage</AdminTableHeadCell>
              <AdminTableHeadCell>Progress</AdminTableHeadCell>
              <AdminTableHeadCell>Signed up</AdminTableHeadCell>
              <AdminTableHeadCell>Est. reward</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {data.referrals.length === 0 ? (
              <AdminTableStateRow colSpan={5}>
                This user has not referred anyone yet.
              </AdminTableStateRow>
            ) : (
              data.referrals.map((item) => (
                <AdminTableRow key={item.id}>
                  <AdminTableCell>
                    {item.referee ? (
                      <>
                        <Link
                          href={userDashboardProfileHref(item.referee.client_id, "referrals")}
                          className="font-medium text-primary hover:underline"
                        >
                          {item.referee.display_name}
                        </Link>
                        <p className="text-caption text-muted-foreground">{item.referee.email}</p>
                      </>
                    ) : (
                      "—"
                    )}
                  </AdminTableCell>
                  <AdminTableCell>
                    <StatusBadge variant="info">{REFERRAL_STAGE_LABELS[item.current_stage]}</StatusBadge>
                  </AdminTableCell>
                  <AdminTableCell>
                    <ReferralProgressSteps stage={item.current_stage} />
                  </AdminTableCell>
                  <AdminTableCell>{formatTimestampDetail(item.signed_up_at)}</AdminTableCell>
                  <AdminTableCell>{formatReferralInr(item.estimated_reward_inr)}</AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminDataTable>
      </div>
    </div>
  );
}
