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
import { ClientProfileTabPanel } from "@/components/clients/client-profile-tab-panel";
import { ClientPortfolioOverview } from "@/components/clients/client-portfolio-overview";
import { ClientPortfolioHoldingsList } from "@/components/clients/client-portfolio-holdings-list";
import { ClientRiskProfileCard } from "@/components/clients/client-risk-profile-card";
import { ClientRiskProfileTab } from "@/components/clients/client-risk-profile-tab";
import { ClientSipsTransactionsTabPanel } from "@/components/clients/client-sips-transactions-tab-panel";
import { ClientSupportTicketsTabPanel } from "@/components/clients/client-support-tickets-tab-panel";
import { useSupportPageChrome } from "@/components/dashboard/support-page-chrome-context";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  getClientDetailErrorMessage,
  isClientNotFoundError,
} from "@/lib/distributor-client-errors";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { fetchSupportUserDetail } from "@/lib/support-users-api";
import type {
  DistributorClientProfile,
  DistributorOrder,
  DistributorSystematicPlan,
} from "@/lib/distributor-types";

type SupportUserDetailPageProps = {
  clientId: string;
};

type ClientProfileState = DistributorClientProfile & {
  orders?: DistributorOrder[];
  systematicPlans?: DistributorSystematicPlan[];
};

type ClientDetailLoadState = "loading" | "ready" | "not_found" | "error";

export function SupportUserDetailPage({ clientId }: SupportUserDetailPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setHideBreadcrumb } = useSupportPageChrome();
  const [profile, setProfile] = useState<ClientProfileState | null>(null);
  const [loadState, setLoadState] = useState<ClientDetailLoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const copy = DISTRIBUTOR_CLIENT_COPY;
  const [defaultTab, setDefaultTab] = useState<ClientDetailTabId>(() => {
    return parseClientDetailTabId(searchParams.get("tab")) ?? "tickets";
  });
  const { showSkeleton } = useClientPageReveal({
    ready: loadState === "ready" && profile !== null,
    resetKey: clientId,
  });

  useEffect(() => {
    setLoadState("loading");
    setProfile(null);
    setErrorMessage("");

    let cancelled = false;
    void fetchSupportUserDetail(clientId)
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
    const fromUrl = parseClientDetailTabId(searchParams.get("tab"));
    setDefaultTab(fromUrl ?? "tickets");
    // Intentionally keyed on client switch only — do not react when `tab` is stripped from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (loadState !== "ready") return;
    if (!searchParams.get("tab")) return;
    router.replace(pathname, { scroll: false });
  }, [loadState, pathname, router, searchParams]);

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
    profile: <ClientProfileTabPanel profile={profile} />,
    portfolio: (
      <>
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
        kycPartnerSnapshot={profile.kycPartnerSnapshot}
        kycRegistrySnapshot={profile.kycRegistrySnapshot}
      />
    ),
    documents: <ClientDocumentsTabPanel profile={profile} />,
    risk: <ClientRiskProfileTab profile={profile} clientReference={clientId} />,
    goals: <ClientGoalsTabPanel profile={profile} />,
    family: (
      <ClientFamilyTabPanel
        groups={profile.familyGroups}
        clientInDistributorBook={investor.inDistributorBook}
        listOrigin="your-book"
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
    tickets: <ClientSupportTicketsTabPanel clientId={clientId} />,
  };

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <h1 className="sr-only">{profile.displayName}</h1>

      <ClientDetailTabsShell
        key={`${clientId}:${defaultTab}`}
        defaultTab={defaultTab}
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
