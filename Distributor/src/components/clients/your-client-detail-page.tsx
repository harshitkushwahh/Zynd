"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarClock,
  Goal,
  HandCoins,
  LineChart,
  PieChart,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { ClientDetailTabsShell } from "@/components/clients/client-detail-tabs-shell";
import { ClientFamilyGroupSummaryCard } from "@/components/clients/client-family-group-summary-card";
import {
  ClientDetailEmptyState,
} from "@/components/clients/client-detail-empty-state";
import { ClientKycJourneyPanel } from "@/components/clients/client-kyc-journey-panel";
import { ClientKycVerificationCard } from "@/components/clients/client-kyc-verification-card";
import { ClientPersonalInfoPanel } from "@/components/clients/client-personal-info-panel";
import { ClientPortfolioHoldingsList } from "@/components/clients/client-portfolio-holdings-list";
import { ClientPortfolioValueChart } from "@/components/clients/client-portfolio-value-chart";
import { ClientRiskProfileCard } from "@/components/clients/client-risk-profile-card";
import { ClientRiskProfileTab } from "@/components/clients/client-risk-profile-tab";
import {
  paginateTableItems,
  Table,
  TableCard,
} from "@/components/application/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getDistributorClientProfile,
  getOrdersForClient,
  getSipsForClient,
} from "@/lib/dummy/client-profile";
import { fetchDistributorClientDetail } from "@/lib/distributor-clients-api";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { env } from "@/lib/env";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { formatAum, formatDistributorDate } from "@/lib/format";
import {
  complianceStatusVariant,
  investmentStatusVariant,
  onboardingStatusVariant,
  orderStatusVariant,
  planStatusVariant,
} from "@/lib/status-meta";
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

function DetailSection({
  title,
  description,
  children,
  noCard = false,
  icon: Icon,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  noCard?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <div
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            <Icon className="size-4" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-compact font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {noCard ? (
        children
      ) : (
        <Card className="overflow-hidden border-border bg-card p-0 shadow-sm">{children}</Card>
      )}
    </section>
  );
}

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="bg-card px-4 py-4">
      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        {Icon ? <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden /> : null}
        {label}
      </p>
      <p className="mt-1 text-h3 font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ClientOrdersTable({
  clientCode,
  ordersOverride,
  emptyMessage,
}: {
  clientCode: string;
  ordersOverride?: DistributorOrder[];
  emptyMessage: string;
}) {
  const orders = ordersOverride ?? getOrdersForClient(clientCode);
  const { pageItems, totalPages, safePage } = paginateTableItems(orders, 1);

  if (orders.length === 0) {
    return (
      <ClientDetailEmptyState message={emptyMessage} icon={ArrowLeftRight} />
    );
  }

  return (
    <Table
      aria-label="Client orders"
      className="min-w-[var(--table-min-width-3xl)]"
      pagination={{
        page: safePage,
        totalPages,
        onPageChange: () => {},
      }}
    >
      <Table.Header>
        <Table.Head id="orderRef" label="Order" isRowHeader />
        <Table.Head id="schemeName" label="Scheme" />
        <Table.Head id="orderType" label="Type" />
        <Table.Head id="amount" label="Amount" className="text-right [&>div]:justify-end" />
        <Table.Head id="status" label="Status" />
        <Table.Head id="createdAt" label="Created" />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(order) => (
          <Table.Row id={order.id}>
            <Table.Cell className="font-mono text-caption">{order.orderRef}</Table.Cell>
            <Table.Cell>{order.schemeName}</Table.Cell>
            <Table.Cell className="text-muted-foreground">{order.orderType}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatAum(order.amount)}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={orderStatusVariant(order.status)}>{order.status}</StatusBadge>
            </Table.Cell>
            <Table.Cell className="text-muted-foreground">
              {formatDistributorDate(order.createdAt)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  );
}

function ClientSipsTable({
  clientCode,
  plansOverride,
  emptyMessage,
}: {
  clientCode: string;
  plansOverride?: DistributorSystematicPlan[];
  emptyMessage: string;
}) {
  const plans = plansOverride ?? getSipsForClient(clientCode);
  const { pageItems, totalPages, safePage } = paginateTableItems(plans, 1);

  if (plans.length === 0) {
    return (
      <ClientDetailEmptyState message={emptyMessage} icon={CalendarClock} />
    );
  }

  return (
    <Table
      aria-label="Client SIPs"
      className="min-w-[var(--table-min-width-2xl)]"
      pagination={{
        page: safePage,
        totalPages,
        onPageChange: () => {},
      }}
    >
      <Table.Header>
        <Table.Head id="planRef" label="Plan" isRowHeader />
        <Table.Head id="planType" label="Type" />
        <Table.Head id="amount" label="Amount" className="text-right [&>div]:justify-end" />
        <Table.Head id="status" label="Status" />
        <Table.Head id="nextDueAt" label="Next due" />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(plan) => (
          <Table.Row id={plan.id}>
            <Table.Cell className="font-mono text-caption">{plan.planRef}</Table.Cell>
            <Table.Cell>{plan.planType}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatAum(plan.amount)}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={planStatusVariant(plan.status)}>{plan.status}</StatusBadge>
            </Table.Cell>
            <Table.Cell className="text-muted-foreground">
              {formatDistributorDate(plan.nextDueAt)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  );
}

export function YourClientDetailPage({ listOrigin, clientId }: YourClientDetailPageProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<ClientProfileState | null>(null);
  const [loading, setLoading] = useState(env.useBackendClients);
  const copy = DISTRIBUTOR_CLIENT_COPY;

  useEffect(() => {
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

  const portfolioTotals = useMemo(() => {
    if (!profile?.holdings.length) {
      const aum = profile?.investor.aum ?? 0;
      return {
        current: aum,
        invested: aum,
        returns: 0,
        redeemable: 0,
      };
    }
    const current = profile.holdings.reduce((sum, row) => sum + row.currentValue, 0);
    const invested = profile.holdings.reduce((sum, row) => sum + row.investedAmount, 0);
    const redeemable = profile.holdings.reduce((sum, row) => sum + row.redeemableValue, 0);
    return { current, invested, returns: current - invested, redeemable };
  }, [profile]);

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-compact text-muted-foreground">{copy.loadingProfile}</p>
      </div>
    );
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
  const initials = profile.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tabPanels = {
    portfolio: (
      <>
        <DetailSection
          title={copy.portfolio.title}
          description={copy.portfolio.description}
          icon={PieChart}
        >
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label={copy.portfolio.currentValue}
              value={formatAum(portfolioTotals.current)}
              icon={Wallet}
            />
            <MetricTile
              label={copy.portfolio.invested}
              value={formatAum(portfolioTotals.invested)}
              icon={LineChart}
            />
            <MetricTile
              label={copy.portfolio.totalReturns}
              value={formatAum(portfolioTotals.returns)}
              hint={
                portfolioTotals.returns >= 0 ? undefined : "Unrealised change vs cost"
              }
              icon={TrendingUp}
            />
            <MetricTile
              label={copy.portfolio.redeemableValue}
              value={formatAum(portfolioTotals.redeemable)}
              icon={HandCoins}
            />
          </div>
        </DetailSection>
        <ClientPortfolioValueChart clientId={clientId} currentValue={portfolioTotals.current} />
        <DetailSection
          title={copy.portfolio.holdingsTitle}
          description={copy.portfolio.holdingsDescription}
          icon={PieChart}
        >
          <ClientPortfolioHoldingsList
            holdings={profile.holdings}
            copy={copy.portfolio}
            emptyMessage={copy.portfolio.holdingsEmpty}
            emptyIcon={PieChart}
          />
        </DetailSection>
      </>
    ),
    personal: <ClientPersonalInfoPanel profile={profile} />,
    kyc: (
      <Card className="border-border bg-card p-5 shadow-sm">
        <ClientKycJourneyPanel
          steps={profile.kycSteps}
          overallStatus={profile.kycOverallStatus}
          investorType={investor.investorType}
        />
      </Card>
    ),
    risk: <ClientRiskProfileTab profile={profile} clientReference={clientId} />,
    goals: (
      <DetailSection title={copy.goals.title} description={copy.goals.description} icon={Goal}>
        {profile.goals.length === 0 ? (
          <ClientDetailEmptyState message={copy.goals.empty} icon={Goal} />
        ) : (
          <ul className="divide-y divide-border">
            {profile.goals.map((goal) => (
              <li key={goal.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <Goal className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="text-compact font-medium">{goal.title}</p>
                      <p className="text-caption text-muted-foreground">
                        {goal.scope === "family" && goal.familyGroupName
                          ? `${copy.goals.family} · ${goal.familyGroupName}`
                          : copy.goals.personal}{" "}
                        · {copy.goals.target} {formatDistributorDate(goal.targetDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-caption">
                    <p className="font-medium text-foreground">{copy.goals.progress}</p>
                    <p className="font-medium tabular-nums">
                      {formatAum(goal.currentAmount)} / {formatAum(goal.targetAmount)}
                    </p>
                    <p className="text-muted-foreground">
                      {goal.progressPct}% · {goal.status}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    ),
    family: (
      <DetailSection
        title={copy.family.title}
        description={copy.family.description}
        icon={Users}
      >
        {profile.familyGroups.length === 0 ? (
          <ClientDetailEmptyState message={copy.family.empty} icon={Users} />
        ) : (
          <div className="space-y-3 p-4">
            {profile.familyGroups.map((group) => (
              <ClientFamilyGroupSummaryCard
                key={group.id}
                group={group}
                listOrigin={listOrigin}
                clientId={clientId}
              />
            ))}
          </div>
        )}
      </DetailSection>
    ),
    transactions: (
      <DetailSection
        title={copy.activity.transactionsTitle}
        description={copy.activity.transactionsDescription}
        icon={ArrowLeftRight}
        noCard
      >
        <TableCard.Root>
          <ClientOrdersTable
            clientCode={investor.clientCode}
            ordersOverride={profile.orders}
            emptyMessage={copy.activity.transactionsEmpty}
          />
        </TableCard.Root>
      </DetailSection>
    ),
    sips: (
      <DetailSection
        title={copy.activity.sipsTitle}
        description={copy.activity.sipsDescription}
        icon={CalendarClock}
        noCard
      >
        <TableCard.Root>
          <ClientSipsTable
            clientCode={investor.clientCode}
            plansOverride={profile.systematicPlans}
            emptyMessage={copy.activity.sipsEmpty}
          />
        </TableCard.Root>
      </DetailSection>
    ),
  };

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <Avatar size="lg" className="size-14 shrink-0">
              {profile.profileImageUrl ? (
                <AvatarImage src={profile.profileImageUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-body font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-h3 font-semibold text-foreground">
                {profile.displayName}
              </h1>
              <p className="mt-1 text-compact text-muted-foreground">{profile.emailDisplay}</p>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {copy.overview.zyndClientCode}{" "}
                <span className="font-mono font-medium text-foreground">{investor.clientCode}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge variant={onboardingStatusVariant(investor.onboardingStatus)}>
                  {investor.onboardingStatus}
                </StatusBadge>
                <StatusBadge variant={complianceStatusVariant(investor.complianceStatus)}>
                  {investor.complianceStatus}
                </StatusBadge>
                <StatusBadge variant={investmentStatusVariant(investor.investmentStatus)}>
                  {investor.investmentStatus}
                </StatusBadge>
                <StatusBadge variant={profile.mfaEnabled ? "success" : "neutral"}>
                  {profile.mfaEnabled ? copy.overview.mfaBadgeOn : copy.overview.mfaBadgeOff}
                </StatusBadge>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2.5 self-start md:pt-0.5">
            <ClientRiskProfileCard profile={profile} variant="inline" />
            <ClientKycVerificationCard
              steps={profile.kycSteps}
              overallStatus={profile.kycOverallStatus}
              investorType={investor.investorType}
              variant="inline"
            />
          </div>
        </div>
      </div>

      <ClientDetailTabsShell panels={tabPanels} />
    </div>
  );
}
