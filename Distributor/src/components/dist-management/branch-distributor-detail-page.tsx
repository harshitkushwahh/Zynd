"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { BranchDistributorBookAumChart } from "@/components/dist-management/branch-distributor-book-aum-chart";
import { BranchDistributorBookHoldingsTable } from "@/components/dist-management/branch-distributor-book-holdings-table";
import { BranchDistributorClientsPanel } from "@/components/dist-management/branch-distributor-clients-panel";
import { BranchDistributorCompliancePanel } from "@/components/dist-management/branch-distributor-compliance-panel";
import { BranchDistributorDetailTabsShell } from "@/components/dist-management/branch-distributor-detail-tabs-shell";
import { BranchDistributorProfileSidebar } from "@/components/dist-management/branch-distributor-profile-sidebar";
import { BranchDistributorReportsPanel } from "@/components/dist-management/branch-distributor-reports-panel";
import { BranchDistributorSipsPanel } from "@/components/dist-management/branch-distributor-sips-panel";
import { BranchDistributorTransactionsPanel } from "@/components/dist-management/branch-distributor-transactions-panel";
import { BranchDistributorWorkPanel } from "@/components/dist-management/branch-distributor-work-panel";
import {
  BranchDistributorSquareCardGrid,
  BranchDistributorSquareMetricCard,
} from "@/components/dist-management/branch-distributor-square-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getFeaturedInvestorsForBranchDistributor,
  getOrdersForBranchDistributor,
  getSipsForBranchDistributor,
  mapPartnerDetailToBranchProfile,
  type BranchDistributorProfile,
} from "@/lib/distributor-branch-distributor-profile-data";
import { fetchDistributorPartnerDetail } from "@/lib/distributor-partners-api";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { formatAum } from "@/lib/format";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

type BranchDistributorDetailPageProps = {
  distributorId: string;
};

function DetailSection({
  children,
  noCard = false,
}: {
  children: ReactNode;
  noCard?: boolean;
}) {
  return (
    <section>
      {noCard ? (
        children
      ) : (
        <Card className="overflow-hidden border-border bg-card p-0 shadow-sm">{children}</Card>
      )}
    </section>
  );
}

export function BranchDistributorDetailPage({ distributorId }: BranchDistributorDetailPageProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<BranchDistributorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchDistributorPartnerDetail(distributorId)
      .then((detail) => {
        if (cancelled) return;
        setProfile(mapPartnerDetailToBranchProfile(detail));
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
          setError(ZYND_MITRA_COPY.notFound);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [distributorId]);

  const featuredInvestors = useMemo(
    () => (profile ? getFeaturedInvestorsForBranchDistributor(profile) : []),
    [profile],
  );

  const orders = useMemo(
    () => (profile ? getOrdersForBranchDistributor(profile) : []),
    [profile],
  );

  const sips = useMemo(
    () => (profile ? getSipsForBranchDistributor(profile) : []),
    [profile],
  );

  if (loading) {
    return (
      <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "flex min-h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground")}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading Zynd Mitra profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "space-y-4")}>
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <p className="text-compact text-muted-foreground">{error || ZYND_MITRA_COPY.notFound}</p>
      </div>
    );
  }

  const bookInvestedAmount = Math.round(profile.aum * 0.88);

  const tabPanels = {
    overview: (
      <>
        <BranchDistributorSquareCardGrid columns={4}>
          <BranchDistributorSquareMetricCard
            icon={Wallet}
            label="Total AUM"
            value={formatAum(profile.aum)}
            hint="Live book"
            tone="accent"
          />
          <BranchDistributorSquareMetricCard
            icon={Users}
            label="Clients"
            value={String(profile.clientCount)}
            hint={`${profile.onboardingCompletePct}% onboarded`}
            tone="soft"
          />
          <BranchDistributorSquareMetricCard
            icon={CalendarClock}
            label="Active SIPs"
            value={String(profile.activeSipCount)}
            hint="Across the book"
          />
          <BranchDistributorSquareMetricCard
            icon={TrendingUp}
            label="MTD inflow"
            value={formatAum(profile.mtdInflow)}
            hint={`Lumpsum ${formatAum(profile.lumpsumMtd)}`}
          />
        </BranchDistributorSquareCardGrid>

        <DetailSection noCard>
          <BranchDistributorBookAumChart
            distributorId={profile.id}
            currentAum={profile.aum}
            investedAmount={bookInvestedAmount}
          />
        </DetailSection>

        <DetailSection noCard>
          <BranchDistributorBookHoldingsTable holdings={profile.bookHoldings} />
        </DetailSection>
      </>
    ),
    clients: (
      <BranchDistributorClientsPanel profile={profile} investors={featuredInvestors} />
    ),
    transactions: (
      <BranchDistributorTransactionsPanel profile={profile} orders={orders} />
    ),
    sips: <BranchDistributorSipsPanel profile={profile} plans={sips} />,
    reports: <BranchDistributorReportsPanel profile={profile} />,
    compliance: <BranchDistributorCompliancePanel profile={profile} />,
    work: <BranchDistributorWorkPanel profile={profile} />,
  };

  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-branch-distributor-detail")}>
      <h1 className="sr-only">{profile.name}</h1>
      <BranchDistributorDetailTabsShell
        panels={tabPanels}
        aside={<BranchDistributorProfileSidebar profile={profile} />}
      />
    </div>
  );
}
