"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck,
  Coins,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import {
  fetchAdminReferralMetrics,
  fetchAdminReferralScheme,
  formatReferralInr,
  type AdminReferralMetrics,
  type AdminReferralScheme,
} from "@/lib/referrals-admin-api";
import { getErrorMessage } from "@/lib/errors";

export function ReferralsOverviewPanel() {
  const [metrics, setMetrics] = useState<AdminReferralMetrics | null>(null);
  const [scheme, setScheme] = useState<AdminReferralScheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [metricsResult, schemeResult] = await Promise.all([
        fetchAdminReferralMetrics(),
        fetchAdminReferralScheme(),
      ]);
      setMetrics(metricsResult);
      setScheme(schemeResult);
    } catch (err) {
      setMetrics(null);
      setScheme(null);
      setError(getErrorMessage(err, "Could not load referral overview."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      {error ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : null}

      <AdminMetricCardsGrid columns="four" className="mt-0 mb-0 min-w-0 max-w-full">
        <AdminMetricCard
          variant="flip"
          label="Link clicks"
          value={metrics?.total_clicks ?? 0}
          icon={MousePointerClick}
          loading={loading}
          back={{
            label: "KYC completed",
            value: metrics?.kyc_verified_count ?? 0,
            icon: ClipboardCheck,
          }}
        />
        <AdminMetricCard
          variant="flip"
          label="Referral signups"
          value={metrics?.total_attributions ?? 0}
          icon={UserPlus}
          loading={loading}
          back={{
            label: "First investment",
            value: metrics?.first_investment_count ?? 0,
            icon: TrendingUp,
          }}
        />
        <AdminMetricCard
          variant="flip"
          label="Active referrers"
          value={metrics?.total_referrers ?? 0}
          icon={Users}
          loading={loading}
          back={{
            label: "Qualified",
            value: metrics?.qualified_count ?? 0,
            icon: ShieldCheck,
          }}
        />
        <AdminMetricCard
          variant="flip"
          label="Est. rewards"
          value={metrics ? formatReferralInr(metrics.estimated_earnings_inr) : "—"}
          icon={Coins}
          loading={loading}
          back={{
            label: "Engaged",
            value: metrics?.engaged_count ?? 0,
            icon: Sparkles,
          }}
        />
      </AdminMetricCardsGrid>

      {scheme ? (
        <div className="rounded-xl border border-border/80 bg-card p-5">
          <AdminSectionTitle>Reward scheme</AdminSectionTitle>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-caption text-muted-foreground">Reward rate</dt>
              <dd className="mt-1 text-compact font-medium text-foreground">{scheme.reward_rate_pct}%</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Min first investment</dt>
              <dd className="mt-1 text-compact font-medium text-foreground">
                {formatReferralInr(scheme.min_first_investment_inr)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Qualification hold</dt>
              <dd className="mt-1 text-compact font-medium text-foreground">
                {scheme.qualification_hold_days} days
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Engagement min invest</dt>
              <dd className="mt-1 text-compact font-medium text-foreground">
                {formatReferralInr(scheme.min_engagement_investment_inr)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">AUM milestone</dt>
              <dd className="mt-1 text-compact font-medium text-foreground">
                {formatReferralInr(scheme.aum_milestone_inr)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Click → signup</dt>
              <dd className="mt-1 text-compact font-medium text-foreground">
                {metrics?.conversion_click_to_signup_pct ?? 0}%
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-caption text-muted-foreground">{scheme.reward_note}</p>
        </div>
      ) : null}
    </div>
  );
}
