"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PieChart } from "lucide-react";

import { ClientDetailPageSkeleton } from "@/components/clients/client-detail-page-skeleton";
import { ClientDetailTabsShell } from "@/components/clients/client-detail-tabs-shell";
import { useClientPageReveal } from "@/components/clients/use-client-page-reveal";
import { ClientDocumentsTabPanel } from "@/components/clients/client-documents-tab-panel";
import { ClientProfileHeroCard } from "@/components/clients/client-profile-hero-card";
import { ClientFamilyTabPanel } from "@/components/clients/client-family-tab-panel";
import { ClientGoalsTabPanel } from "@/components/clients/client-goals-tab-panel";
import { ClientKycJourneyPanel } from "@/components/clients/client-kyc-journey-panel";
import { ClientKycVerificationCard } from "@/components/clients/client-kyc-verification-card";
import { ClientPersonalInfoPanel } from "@/components/clients/client-personal-info-panel";
import { ClientPortfolioOverview } from "@/components/clients/client-portfolio-overview";
import { ClientPortfolioHoldingsList } from "@/components/clients/client-portfolio-holdings-list";
import { ClientRiskProfileCard } from "@/components/clients/client-risk-profile-card";
import { ClientRiskProfileTab } from "@/components/clients/client-risk-profile-tab";
import { ClientSipsTransactionsTabPanel } from "@/components/clients/client-sips-transactions-tab-panel";
import { Button } from "@/components/ui/button";
import { getDistributorClientProfile } from "@/lib/dummy/client-profile";
import { fetchDistributorClientDetail } from "@/lib/distributor-clients-api";
import {
  buildDistributorClientPortfolioDemoHoldings,
  getDistributorClientPortfolioDemo,
} from "@/lib/distributor-client-portfolio-demo";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { env } from "@/lib/env";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import type {
  DistributorClientProfile,
  DistributorOrder,
  DistributorSystematicPlan,
} from "@/lib/dummy/types";

type YourClientDetailPageProps = {
  listOrigin: DistributorClientListOrigin;
  clientId: string;
};

type ClientProfileState = DistributorClientProfile & {
  orders?: DistributorOrder[];
  systematicPlans?: DistributorSystematicPlan[];
};

export function YourClientDetailPage({ listOrigin, clientId }: YourClientDetailPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ClientProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const copy = DISTRIBUTOR_CLIENT_COPY;
  const { showSkeleton } = useClientPageReveal({
    ready: !loading && profile !== null,
    resetKey: clientId,
  });

  useEffect(() => {
    setLoading(true);
    setProfile(null);

    if (!env.useBackendClients) {
      setProfile(getDistributorClientProfile(clientId));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchDistributorClientDetail(clientId)
      .then((payload) => {
        if (!cancelled) setProfile(payload);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!searchParams.get("tab")) return;
    router.replace(pathname, { scroll: false });
  }, [clientId, pathname, router, searchParams]);

  const portfolioHoldings = useMemo(() => {
    if (!profile) return [];
    if (profile.holdings.length > 0) return profile.holdings;
    const demo = getDistributorClientPortfolioDemo(clientId);
    return buildDistributorClientPortfolioDemoHoldings(
      profile.investor.id,
      profile.investor.clientCode,
      demo,
    );
  }, [profile, clientId]);

  const portfolioTotals = useMemo(() => {
    if (!portfolioHoldings.length) {
      const demo = getDistributorClientPortfolioDemo(clientId);
      return {
        current: demo.current,
        invested: demo.invested,
        returns: demo.returns,
        redeemable: demo.redeemable,
      };
    }
    const current = portfolioHoldings.reduce((sum, row) => sum + row.currentValue, 0);
    const invested = portfolioHoldings.reduce((sum, row) => sum + row.investedAmount, 0);
    const redeemable = portfolioHoldings.reduce((sum, row) => sum + row.redeemableValue, 0);
    return { current, invested, returns: current - invested, redeemable };
  }, [portfolioHoldings, clientId]);

  if (loading || (profile && showSkeleton)) {
    return <ClientDetailPageSkeleton />;
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <p className="text-compact text-muted-foreground">{copy.clientNotFound}</p>
      </div>
    );
  }

  const { investor } = profile;

  const tabPanels = {
    portfolio: (
      <>
        <ClientPersonalInfoPanel profile={profile} />
        <ClientPortfolioOverview
          clientId={clientId}
          profile={{ ...profile, holdings: portfolioHoldings }}
          totals={portfolioTotals}
        />
        <ClientPortfolioHoldingsList
          holdings={portfolioHoldings}
          copy={copy.portfolio}
          emptyMessage={copy.portfolio.holdingsEmpty}
          emptyIcon={PieChart}
        />
      </>
    ),
    kyc: (
      <ClientKycJourneyPanel
        steps={profile.kycSteps}
        overallStatus={profile.kycOverallStatus}
        investorType={investor.investorType}
        kycCompliant={investor.complianceStatus === "Compliant"}
        kycInitiatedAt={profile.kycInitiatedAt}
        kycAuditLog={profile.kycAuditLog}
      />
    ),
    documents: <ClientDocumentsTabPanel profile={profile} />,
    risk: <ClientRiskProfileTab profile={profile} clientReference={clientId} />,
    goals: <ClientGoalsTabPanel profile={profile} />,
    family: (
      <ClientFamilyTabPanel
        groups={profile.familyGroups}
        clientInDistributorBook={investor.inDistributorBook}
        listOrigin={listOrigin}
        clientId={clientId}
      />
    ),
    transactions: (
      <ClientSipsTransactionsTabPanel
        investor={investor}
        ordersOverride={profile.orders}
        systematicPlansOverride={profile.systematicPlans}
      />
    ),
  };

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <h1 className="sr-only">{profile.displayName}</h1>

      <ClientDetailTabsShell
        key={clientId}
        defaultTab="portfolio"
        panels={tabPanels}
        aside={
          <>
            <ClientProfileHeroCard profile={profile} />
            <ClientKycVerificationCard
              steps={profile.kycSteps}
              overallStatus={profile.kycOverallStatus}
              investorType={investor.investorType}
              kycCompliant={investor.complianceStatus === "Compliant"}
              variant="sidebar"
            />
            <ClientRiskProfileCard profile={profile} clientReference={clientId} variant="sidebar" />
          </>
        }
      />
    </div>
  );
}
