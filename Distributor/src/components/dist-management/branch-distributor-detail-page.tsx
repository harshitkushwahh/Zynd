"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarClock,
  HandCoins,
  IndianRupee,
  LineChart,
  PieChart,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { BranchDistributorDetailTabsShell } from "@/components/dist-management/branch-distributor-detail-tabs-shell";
import { ClientDetailEmptyState } from "@/components/clients/client-detail-empty-state";
import { ClientPortfolioValueChart } from "@/components/clients/client-portfolio-value-chart";
import { paginateTableItems, Table, TableCard } from "@/components/application/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getBranchDistributorProfile,
  getFeaturedInvestorsForBranchDistributor,
  getOrdersForBranchDistributor,
  getSipsForBranchDistributor,
  type BranchDistributorBookHolding,
  type BranchDistributorProfile,
} from "@/lib/dummy/branch-distributor-profile";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import {
  distributorClientDetailHref,
  getDistributorClientProfile,
} from "@/lib/dummy/client-profile";
import { DISTRIBUTOR_LABEL_CAPS_CLASS, DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { formatAum, formatDistributorDate } from "@/lib/format";
import {
  investmentStatusVariant,
  onboardingStatusVariant,
  orderStatusVariant,
  planStatusVariant,
} from "@/lib/status-meta";
import type { DistributorInvestor, DistributorOrder, DistributorSystematicPlan } from "@/lib/dummy/types";
import { cn } from "@/lib/utils";

type BranchDistributorDetailPageProps = {
  distributorId: string;
};

function statusVariant(status: BranchDistributorProfile["status"]) {
  if (status === "Active") return "success" as const;
  if (status === "Onboarding") return "warning" as const;
  return "destructive" as const;
}

function clientListOrigin(investor: DistributorInvestor): DistributorClientListOrigin {
  return investor.inDistributorBook ? "your-book" : "system-resident";
}

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

function BookHoldingsList({ holdings }: { holdings: BranchDistributorBookHolding[] }) {
  if (holdings.length === 0) {
    return (
      <ClientDetailEmptyState
        message="No book-level holdings yet. AUM will appear once clients start investing."
        icon={PieChart}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {holdings.map((row) => (
        <li
          key={row.id}
          className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]"
        >
          <div className="min-w-0">
            <p className="text-compact font-medium text-foreground">{row.schemeName}</p>
            <p className="text-caption text-muted-foreground">{row.amcName}</p>
          </div>
          <div className="sm:text-right">
            <p className={DISTRIBUTOR_LABEL_CAPS_CLASS}>Book AUM</p>
            <p className="text-compact font-medium tabular-nums">{formatAum(row.totalAum)}</p>
          </div>
          <div className="sm:text-right">
            <p className={DISTRIBUTOR_LABEL_CAPS_CLASS}>Clients</p>
            <p className="text-compact font-medium tabular-nums">{row.clientCount}</p>
          </div>
          <div className="sm:text-right">
            <p className={DISTRIBUTOR_LABEL_CAPS_CLASS}>SIP share</p>
            <p className="text-compact font-medium tabular-nums">{row.sipSharePct}%</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DistributorOrdersTable({
  orders,
  emptyMessage,
}: {
  orders: DistributorOrder[];
  emptyMessage: string;
}) {
  const { pageItems, totalPages, safePage } = paginateTableItems(orders, 1);

  if (orders.length === 0) {
    return <ClientDetailEmptyState message={emptyMessage} icon={ArrowLeftRight} />;
  }

  return (
    <Table
      aria-label="Distributor book transactions"
      className="min-w-[var(--table-min-width-3xl)]"
      pagination={{
        page: safePage,
        totalPages,
        onPageChange: () => {},
      }}
    >
      <Table.Header>
        <Table.Head id="orderRef" label="Order" isRowHeader />
        <Table.Head id="clientCode" label="Client" />
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
            <Table.Cell className="font-mono text-caption">{order.clientCode}</Table.Cell>
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

function DistributorSipsTable({
  plans,
  emptyMessage,
}: {
  plans: DistributorSystematicPlan[];
  emptyMessage: string;
}) {
  const { pageItems, totalPages, safePage } = paginateTableItems(plans, 1);

  if (plans.length === 0) {
    return <ClientDetailEmptyState message={emptyMessage} icon={CalendarClock} />;
  }

  return (
    <Table
      aria-label="Distributor systematic plans"
      className="min-w-[var(--table-min-width-lg)]"
      pagination={{
        page: safePage,
        totalPages,
        onPageChange: () => {},
      }}
    >
      <Table.Header>
        <Table.Head id="planRef" label="Plan" isRowHeader />
        <Table.Head id="clientCode" label="Client" />
        <Table.Head id="planType" label="Type" />
        <Table.Head id="amount" label="Amount" className="text-right [&>div]:justify-end" />
        <Table.Head id="status" label="Status" />
        <Table.Head id="nextDueAt" label="Next due" />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(plan) => (
          <Table.Row id={plan.id}>
            <Table.Cell className="font-mono text-caption">{plan.planRef}</Table.Cell>
            <Table.Cell className="font-mono text-caption">{plan.clientCode}</Table.Cell>
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

export function BranchDistributorDetailPage({ distributorId }: BranchDistributorDetailPageProps) {
  const router = useRouter();
  const profile = useMemo(() => getBranchDistributorProfile(distributorId), [distributorId]);

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

  if (!profile) {
    return (
      <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "space-y-4")}>
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <p className="text-compact text-muted-foreground">Distributor not found in this branch.</p>
      </div>
    );
  }

  const initials = profile.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tabPanels = {
    overview: (
      <>
        <DetailSection
          title="Branch book snapshot"
          description="Aggregated metrics for this distributor’s mapped investor book (demo)."
          icon={LineChart}
        >
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <MetricTile icon={Wallet} label="Total AUM" value={formatAum(profile.aum)} hint="Live book" />
            <MetricTile
              icon={Users}
              label="Clients"
              value={String(profile.clientCount)}
              hint={`${profile.onboardingCompletePct}% onboarded`}
            />
            <MetricTile
              icon={CalendarClock}
              label="Active SIPs"
              value={String(profile.activeSipCount)}
              hint="Across the book"
            />
            <MetricTile
              icon={TrendingUp}
              label="MTD inflow"
              value={formatAum(profile.mtdInflow)}
              hint={`Lumpsum ${formatAum(profile.lumpsumMtd)}`}
            />
          </div>
        </DetailSection>

        <DetailSection
          title="Distributor profile"
          description="Registration and contact details on file."
          icon={Users}
        >
          <dl className="grid gap-4 p-4 sm:grid-cols-2">
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_CLASS}>Email</dt>
              <dd className="mt-1 text-compact text-foreground">{profile.email}</dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_CLASS}>Mobile</dt>
              <dd className="mt-1 text-compact text-foreground">{profile.mobileMasked}</dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_CLASS}>ARN</dt>
              <dd className="mt-1 font-mono text-compact text-foreground">{profile.arn}</dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_CLASS}>EUIN</dt>
              <dd className="mt-1 font-mono text-compact text-foreground">{profile.euin}</dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_CLASS}>Joined branch</dt>
              <dd className="mt-1 text-compact text-foreground">
                {formatDistributorDate(profile.joinedAt)}
              </dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_CLASS}>Status</dt>
              <dd className="mt-1">
                <StatusBadge variant={statusVariant(profile.status)}>{profile.status}</StatusBadge>
              </dd>
            </div>
          </dl>
        </DetailSection>

        <DetailSection
          title="AUM trend"
          description="Book value over time (synthetic series seeded from distributor id)."
          icon={PieChart}
          noCard
        >
          <ClientPortfolioValueChart clientId={profile.id} currentValue={profile.aum} />
        </DetailSection>
      </>
    ),
    portfolio: (
      <>
        <DetailSection
          title="Book portfolio value"
          description="Historical AUM for the full mapped book."
          icon={PieChart}
          noCard
        >
          <ClientPortfolioValueChart clientId={profile.id} currentValue={profile.aum} />
        </DetailSection>
        <DetailSection
          title="Scheme-wise book composition"
          description="Aggregated holdings across all clients under this distributor."
          icon={HandCoins}
        >
          <BookHoldingsList holdings={profile.bookHoldings} />
        </DetailSection>
      </>
    ),
    clients: (
      <DetailSection
        title="Sample clients"
        description={`Showing ${featuredInvestors.length} clients from the demo book. Full count: ${profile.clientCount}.`}
        icon={Users}
        noCard
      >
        <TableCard.Root>
          <TableCard.Content>
            <Table aria-label="Distributor clients sample" size="md">
              <Table.Header>
                <Table.Head isRowHeader>Name</Table.Head>
                <Table.Head>Client code</Table.Head>
                <Table.Head>Type</Table.Head>
                <Table.Head>AUM</Table.Head>
                <Table.Head>Onboarding</Table.Head>
                <Table.Head>Invested</Table.Head>
              </Table.Header>
              <Table.Body items={featuredInvestors}>
                {(investor) => {
                  const clientProfile = getDistributorClientProfile(investor.id);
                  const name = clientProfile?.displayName ?? investor.clientCode;
                  const origin = clientListOrigin(investor);
                  return (
                    <Table.Row
                      id={investor.id}
                      className="cursor-pointer"
                      onAction={() =>
                        router.push(distributorClientDetailHref(origin, investor.id))
                      }
                    >
                      <Table.Cell>
                        <Link
                          href={distributorClientDetailHref(origin, investor.id)}
                          className="font-medium text-foreground hover:underline"
                        >
                          {name}
                        </Link>
                      </Table.Cell>
                      <Table.Cell className="font-mono text-caption">{investor.clientCode}</Table.Cell>
                      <Table.Cell className="text-muted-foreground">{investor.investorType}</Table.Cell>
                      <Table.Cell className="tabular-nums">
                        {investor.aum != null && investor.aum > 0 ? formatAum(investor.aum) : "—"}
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge variant={onboardingStatusVariant(investor.onboardingStatus)}>
                          {investor.onboardingStatus}
                        </StatusBadge>
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge variant={investmentStatusVariant(investor.investmentStatus)}>
                          {investor.investmentStatus}
                        </StatusBadge>
                      </Table.Cell>
                    </Table.Row>
                  );
                }}
              </Table.Body>
            </Table>
          </TableCard.Content>
        </TableCard.Root>
      </DetailSection>
    ),
    transactions: (
      <DetailSection
        title="Recent transactions"
        description="Orders from sample clients in this distributor’s book (demo subset)."
        icon={ArrowLeftRight}
        noCard
      >
        <TableCard.Root>
          <DistributorOrdersTable
            orders={orders}
            emptyMessage="No transactions in the demo sample for this distributor yet."
          />
        </TableCard.Root>
      </DetailSection>
    ),
    sips: (
      <DetailSection
        title="Systematic plans"
        description={`${profile.activeSipCount} active SIPs on book · sample plans below.`}
        icon={CalendarClock}
        noCard
      >
        <TableCard.Root>
          <DistributorSipsTable
            plans={sips}
            emptyMessage="No SIPs in the demo sample for this distributor yet."
          />
        </TableCard.Root>
      </DetailSection>
    ),
  };

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <Avatar size="lg" className="size-14 shrink-0">
            <AvatarFallback className="text-body font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-h3 font-semibold text-foreground">{profile.name}</h1>
            <p className="mt-1 text-compact text-muted-foreground">{profile.email}</p>
            <p className="mt-0.5 text-caption text-muted-foreground">
              ARN <span className="font-mono font-medium text-foreground">{profile.arn}</span>
              {" · "}
              EUIN <span className="font-mono font-medium text-foreground">{profile.euin}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge variant={statusVariant(profile.status)}>{profile.status}</StatusBadge>
              <StatusBadge variant="neutral">
                <Users className="mr-1 inline size-3" aria-hidden />
                {profile.clientCount} clients
              </StatusBadge>
              <StatusBadge variant="neutral">
                <IndianRupee className="mr-1 inline size-3" aria-hidden />
                {formatAum(profile.aum)} AUM
              </StatusBadge>
            </div>
          </div>
        </div>
      </div>

      <BranchDistributorDetailTabsShell panels={tabPanels} />
    </div>
  );
}
