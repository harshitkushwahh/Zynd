"use client";

import { notFound, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CircleAlert, PieChart } from "lucide-react";

import { ClientDetailEmptyState } from "@/components/clients/client-detail-empty-state";
import { ClientDetailNotFoundView } from "@/components/clients/client-detail-not-found-view";
import { ClientDetailPageSkeleton } from "@/components/clients/client-detail-page-skeleton";
import { ClientDetailTabsShell } from "@/components/clients/client-detail-tabs-shell";
import type { ClientDetailTabId } from "@/components/clients/client-detail-tab-ids";
import { parseClientDetailTabId } from "@/components/clients/client-detail-tab-ids";
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
import { useDistributorPageChrome } from "@/components/dashboard/distributor-page-chrome-context";
import { fetchDistributorClientDetail } from "@/lib/distributor-clients-api";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  getClientDetailErrorMessage,
  isClientNotFoundError,
} from "@/lib/distributor-client-errors";
import { type DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import type {
  DistributorClientProfile,
  DistributorOrder,
  DistributorSystematicPlan,
} from "@/lib/distributor-types";

type YourClientDetailPageProps = {
  listOrigin: DistributorClientListOrigin;
  clientId: string;
};

type ClientProfileState = DistributorClientProfile & {
  orders?: DistributorOrder[];
  systematicPlans?: DistributorSystematicPlan[];
};

type ClientDetailLoadState = "loading" | "ready" | "not_found" | "error";

export function YourClientDetailPage({ listOrigin, clientId }: YourClientDetailPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setHideBreadcrumb } = useDistributorPageChrome();
  const [profile, setProfile] = useState<ClientProfileState | null>(null);
  const [loadState, setLoadState] = useState<ClientDetailLoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const copy = DISTRIBUTOR_CLIENT_COPY;
  const tabFromUrl = parseClientDetailTabId(searchParams.get("tab"));
  const initialTab: ClientDetailTabId = tabFromUrl ?? "portfolio";
  const { showSkeleton } = useClientPageReveal({
    ready: loadState === "ready" && profile !== null,
    resetKey: clientId,
  });

  useEffect(() => {
    setLoadState("loading");
    setProfile(null);
    setErrorMessage("");

    let cancelled = false;
    void fetchDistributorClientDetail(clientId)
      .then((payload) => {
        if (!cancelled) {
          setProfile(payload);
          setLoadState("ready");
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProfile(null);
        if (isClientNotFoundError(error)) {
          setLoadState("not_found");
          return;
        }
        setLoadState("error");
        setErrorMessage(getClientDetailErrorMessage(error));
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!searchParams.get("tab")) return;
    router.replace(pathname, { scroll: false });
  }, [clientId, initialTab, pathname, router, searchParams]);

  useEffect(() => {
    const hideChrome = loadState === "not_found" || loadState === "error";
    setHideBreadcrumb(hideChrome);
    return () => setHideBreadcrumb(false);
  }, [loadState, setHideBreadcrumb]);

  const portfolioHoldings = useMemo(() => profile?.holdings ?? [], [profile]);

  const portfolioTotals = useMemo(() => {
    if (!portfolioHoldings.length) {
      return { current: 0, invested: 0, returns: 0, redeemable: 0 };
    }
    const current = portfolioHoldings.reduce((sum, row) => sum + row.currentValue, 0);
    const invested = portfolioHoldings.reduce((sum, row) => sum + row.investedAmount, 0);
    const redeemable = portfolioHoldings.reduce((sum, row) => sum + row.redeemableValue, 0);
    return { current, invested, returns: current - invested, redeemable };
  }, [portfolioHoldings]);

  if (loadState === "loading" || (profile && showSkeleton)) {
    return <ClientDetailPageSkeleton />;
  }

  if (loadState === "not_found") {
    notFound();
  }

  if (loadState === "error") {
    return (
      <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
        <ClientDetailEmptyState message={errorMessage} icon={CircleAlert} />
      </div>
    );
  }

  if (!profile) {
    return <ClientDetailNotFoundView />;
  }

  const { investor } = profile;

  const tabPanels = {
    portfolio: (
      <>
        <ClientPersonalInfoPanel profile={profile} />
        <ClientPortfolioOverview
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
        key={`${clientId}:${initialTab}`}
        defaultTab={initialTab}
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
