"use client";

import { useCallback, useId, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { FamilyGroupGoalDetailDialog } from "@/components/clients/family-group-goal-detail-dialog";
import { FamilyGroupGoalTile } from "@/components/clients/family-group-goal-tile";
import { FamilyGroupMembersTablePanel } from "@/components/clients/family-group-members-table-panel";
import { Crown, Target, UsersRound } from "lucide-react";
import {
  ClientPortfolioChartToolbar,
  ClientPortfolioValueChart,
  usePortfolioValueChartControls,
} from "@/components/clients/client-portfolio-value-chart";
import {
  resolveClientPortfolioChartSeries,
  resolveEnabledClientPortfolioChartPeriods,
} from "@/lib/client-portfolio-chart-data";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import type {
  DistributorClientFamilyGroup,
  DistributorClientFamilyMember,
  DistributorClientGoal,
} from "@/lib/distributor-types";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import {
  familyGroupAvatarInitials,
  familyGroupAvatarSrc,
  familyGroupDescription,
} from "@/lib/distributor-family-group-display";
import { formatAum, formatPortfolioMetricAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

const CONTRIBUTION_COLORS = ["#3d6b5e", "#5a9fd4", "#7ec8a8", "#94a3b8"];

type FamilyGroupDashboardProps = {
  group: DistributorClientFamilyGroup;
  clientName: string;
  clientId: string;
  listOrigin: DistributorClientListOrigin;
  className?: string;
};

function deriveFamilyPortfolioTotals(totalValue: number) {
  const current = Math.max(0, totalValue);
  const invested = current > 0 ? Math.round(current * 0.92) : 0;
  const returns = current - invested;
  return { current, invested, returns };
}

function toggleFocusedMemberId(current: string | null, userId: string) {
  return current === userId ? null : userId;
}

const FAMILY_CONTRIBUTIONS_RING = { size: 172, outer: 76, inner: 54 } as const;

export function FamilyGroupDashboard({
  group,
  clientName,
  clientId,
  listOrigin,
  className,
}: FamilyGroupDashboardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.family;
  const portfolioCopy = DISTRIBUTOR_CLIENT_COPY.portfolio;
  const portfolio = deriveFamilyPortfolioTotals(group.totalValue);
  const isOwner = group.role === "owner";
  const goals = group.goals ?? [];
  const roleLabel = group.role === "owner" ? "Owner" : "Member";
  const roleHint =
    group.role === "owner"
      ? copy.roleTileHintOwner
      : `${copy.roleTileHintMember} · ${clientName}`;

  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null);
  const memberBadgeRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const contributionData = useMemo(
    () =>
      group.members.map((member, index) => ({
        userId: member.userId,
        name: member.displayName.split(" ")[0] ?? member.displayName,
        fullName: member.displayName,
        value: member.portfolioContribution ?? 0,
        fill: CONTRIBUTION_COLORS[index % CONTRIBUTION_COLORS.length],
      })),
    [group.members],
  );

  const focusMember = useCallback((userId: string | null) => {
    setFocusedMemberId(userId);
    if (userId) {
      requestAnimationFrame(() => {
        memberBadgeRefs.current[userId]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      });
    }
  }, []);

  const handleMemberFocusToggle = useCallback(
    (userId: string) => {
      focusMember(toggleFocusedMemberId(focusedMemberId, userId));
    },
    [focusMember, focusedMemberId],
  );

  const portfolioChartControls = usePortfolioValueChartControls();
  const portfolioChartSeries = useMemo(
    () =>
      resolveClientPortfolioChartSeries(
        [],
        portfolio.current,
        portfolio.invested,
      ),
    [portfolio.current, portfolio.invested],
  );
  const enabledPortfolioChartPeriods = useMemo(
    () => resolveEnabledClientPortfolioChartPeriods(portfolioChartSeries),
    [portfolioChartSeries],
  );
  const groupAvatarSrc = familyGroupAvatarSrc(group);
  const groupDescription = familyGroupDescription(group, copy.familyGroupIdentityDescription);

  return (
    <div className={cn("distributor-family-group-dashboard", className)}>
      <div
        className={cn(
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
          "distributor-family-group-dashboard__hero-row",
        )}
      >
        <Card className="distributor-family-group-dashboard__identity-card border-border bg-card shadow-sm">
          <Avatar className="distributor-family-group-dashboard__identity-avatar size-14 shrink-0">
            <AvatarImage src={groupAvatarSrc} alt="" />
            <AvatarFallback className="text-caption font-semibold">
              {familyGroupAvatarInitials(group.name)}
            </AvatarFallback>
          </Avatar>
          <h1 className="distributor-family-group-dashboard__title">{group.name}</h1>
          <p className="distributor-family-group-dashboard__description">{groupDescription}</p>
        </Card>

        <DistributorMetricCard
          className={cn(
            DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
            "distributor-family-group-dashboard__metric-tile",
          )}
          variant="tile"
          tileTone="accent"
          icon={UsersRound}
          label={copy.membersTileLabel}
          value={String(group.memberCount)}
          hint={copy.membersTileHint}
          showTileAction={false}
        />
        <DistributorMetricCard
          className={cn(
            DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
            "distributor-family-group-dashboard__metric-tile",
          )}
          variant="tile"
          icon={Target}
          label={copy.goalsTileLabel}
          value={String(group.activeGoals)}
          hint={copy.goalsTileHint}
          showTileAction={false}
        />
        <DistributorMetricCard
          className={cn(
            DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
            "distributor-family-group-dashboard__metric-tile",
          )}
          variant="tile"
          icon={Crown}
          label={copy.roleTileLabel}
          value={roleLabel}
          hint={roleHint}
          showTileAction={false}
        />
      </div>

      <div className="distributor-family-group-dashboard__main">
        <Card className="distributor-family-group-dashboard__portfolio-card overflow-hidden border-border bg-card p-0 shadow-sm">
          <div className="distributor-family-group-dashboard__portfolio-head">
            <div className="distributor-family-group-dashboard__portfolio-head-primary">
              <DistributorInsightCardHeader
                eyebrow={copy.portfolioWidgetHint}
                title={copy.portfolioSectionTitle}
                titleAs="p"
              />
              <p className="distributor-family-group-dashboard__portfolio-value tabular-nums">
                {formatPortfolioMetricAmount(portfolio.current)}
              </p>
            </div>

            <div className="distributor-family-group-dashboard__portfolio-head-aside">
              <div className="distributor-family-group-dashboard__portfolio-stat-chips">
                <article className="distributor-family-group-dashboard__portfolio-stat-chip">
                  <span className="distributor-family-group-dashboard__portfolio-stat-chip-label">
                    {portfolioCopy.invested}
                  </span>
                  <span
                    className="distributor-family-group-dashboard__portfolio-stat-chip-value tabular-nums"
                    title={formatAum(portfolio.invested)}
                  >
                    {formatPortfolioMetricAmount(portfolio.invested)}
                  </span>
                </article>
                <article className="distributor-family-group-dashboard__portfolio-stat-chip">
                  <span className="distributor-family-group-dashboard__portfolio-stat-chip-label">
                    {portfolioCopy.totalReturns}
                  </span>
                  <span
                    className="distributor-family-group-dashboard__portfolio-stat-chip-value tabular-nums"
                    title={formatAum(portfolio.returns)}
                  >
                    {formatPortfolioMetricAmount(portfolio.returns)}
                  </span>
                </article>
              </div>

              <ClientPortfolioChartToolbar
                layout="inline"
                showLegend={false}
                showRefresh={false}
                period={portfolioChartControls.period}
                enabledPeriods={enabledPortfolioChartPeriods}
                onPeriodChange={portfolioChartControls.setPeriod}
              />
            </div>
          </div>
          <ClientPortfolioValueChart
            series={[]}
            currentValue={portfolio.current}
            investedAmount={portfolio.invested}
            className="distributor-family-group-dashboard__chart"
            hideToolbar
            period={portfolioChartControls.period}
            onPeriodChange={portfolioChartControls.setPeriod}
            refreshKey={portfolioChartControls.refreshKey}
          />
        </Card>

        <FamilyGroupContributionsCard
          copy={copy}
          members={group.members}
          contributionData={contributionData}
          focusedMemberId={focusedMemberId}
          onMemberFocusToggle={handleMemberFocusToggle}
          memberBadgeRefs={memberBadgeRefs}
        />
      </div>

      {isOwner ? (
        <FamilyGroupGoalsSection goals={goals} />
      ) : (
        <Card className="distributor-family-group-dashboard__goals-locked-card border-border bg-muted/20 px-4 py-3 shadow-none">
          <p className="text-caption text-muted-foreground">{copy.goalsOwnerOnly}</p>
        </Card>
      )}

      <FamilyGroupMembersTablePanel
        group={group}
        listOrigin={listOrigin}
        focusedMemberId={focusedMemberId}
      />
    </div>
  );
}

type ContributionChartPoint = {
  userId: string;
  name: string;
  fullName: string;
  value: number;
  fill: string;
};

type FamilyGroupContributionsCardProps = {
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["family"];
  members: DistributorClientFamilyMember[];
  contributionData: ContributionChartPoint[];
  focusedMemberId: string | null;
  onMemberFocusToggle: (userId: string) => void;
  memberBadgeRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
};

function FamilyGroupContributionsCard({
  copy,
  members,
  contributionData,
  focusedMemberId,
  onMemberFocusToggle,
  memberBadgeRefs,
}: FamilyGroupContributionsCardProps) {
  const trackGradientId = useId().replace(/:/g, "");
  const chartFocused = focusedMemberId !== null;

  const ringTotal = useMemo(
    () => contributionData.reduce((sum, segment) => sum + segment.value, 0),
    [contributionData],
  );

  const focusedMember = useMemo(
    () => members.find((member) => member.userId === focusedMemberId),
    [focusedMemberId, members],
  );

  const ringCenterValue = focusedMember
    ? formatPortfolioMetricAmount(focusedMember.portfolioContribution ?? 0)
    : formatPortfolioMetricAmount(ringTotal);

  const ringCenterCaption = focusedMember
    ? (focusedMember.displayName.split(" ")[0] ?? focusedMember.displayName)
    : copy.contributionsRingTotalLabel;

  return (
    <Card className="distributor-family-group-dashboard__contributions-card h-full border-border bg-card p-0 shadow-sm">
      <div className="distributor-family-group-dashboard__contributions-body p-4 pb-3">
        <DistributorInsightCardHeader
          className="mb-3"
          eyebrow={copy.portfolioWidgetHint}
          title={copy.contributionsTitle}
        />

        <div className="distributor-family-group-dashboard__contributions-stack">
          <div
            className="distributor-family-group-dashboard__contributions-ring"
            role="img"
            aria-label={copy.contributionsRingAriaLabel(members.length, formatAum(ringTotal))}
          >
            <div className="distributor-family-group-dashboard__contributions-ring-chart">
              <ResponsiveContainer
                width="100%"
                height={FAMILY_CONTRIBUTIONS_RING.size}
                minWidth={0}
              >
                <PieChart margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
                  <defs>
                    <linearGradient id={trackGradientId} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--muted)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={[{ value: 1 }]}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={FAMILY_CONTRIBUTIONS_RING.inner}
                    outerRadius={FAMILY_CONTRIBUTIONS_RING.outer}
                    fill={`url(#${trackGradientId})`}
                    stroke="color-mix(in oklab, var(--border) 65%, transparent)"
                    strokeWidth={1}
                    strokeDasharray="4 6"
                    isAnimationActive={false}
                  />
                  {ringTotal > 0 ? (
                    <Pie
                      data={contributionData}
                      dataKey="value"
                      nameKey="fullName"
                      cx="50%"
                      cy="50%"
                      innerRadius={FAMILY_CONTRIBUTIONS_RING.inner}
                      outerRadius={FAMILY_CONTRIBUTIONS_RING.outer}
                      paddingAngle={4}
                      cornerRadius={6}
                      stroke="none"
                      isAnimationActive
                    >
                      {contributionData.map((entry) => {
                        const isFocused = focusedMemberId === entry.userId;
                        const isDimmed = chartFocused && !isFocused;

                        return (
                          <Cell
                            key={entry.userId}
                            fill={entry.fill}
                            fillOpacity={isDimmed ? 0.28 : 0.88}
                            stroke={isFocused ? "var(--primary)" : undefined}
                            strokeWidth={isFocused ? 2 : 0}
                          />
                        );
                      })}
                    </Pie>
                  ) : null}
                  <Tooltip
                    formatter={(value) => formatAum(Number(value))}
                    contentStyle={{
                      borderRadius: "var(--radius-control)",
                      border: "1px solid var(--border)",
                      fontSize: "0.75rem",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="distributor-family-group-dashboard__contributions-ring-center">
                <p className="distributor-family-group-dashboard__contributions-ring-value tabular-nums">
                  {ringCenterValue}
                </p>
                <p className="distributor-family-group-dashboard__contributions-ring-caption">
                  {ringCenterCaption}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer
        className="distributor-family-group-dashboard__contributions-footer"
        role="list"
        aria-label={copy.contributionsMemberBadgesLabel}
      >
        {members.map((member) => {
            const isSelected = focusedMemberId === member.userId;

            return (
              <button
                key={member.userId}
                type="button"
                role="listitem"
                ref={(node) => {
                  memberBadgeRefs.current[member.userId] = node;
                }}
                className={cn(
                  "distributor-family-group-dashboard__member-chip-trigger",
                  isSelected && "distributor-family-group-dashboard__member-chip-trigger--selected",
                )}
                aria-pressed={isSelected}
                aria-label={`${member.displayName}, ${formatAum(member.portfolioContribution ?? 0)}`}
                onClick={() => onMemberFocusToggle(member.userId)}
              >
                <StatusBadge variant="info">{member.displayName}</StatusBadge>
              </button>
            );
          })}
      </footer>
    </Card>
  );
}

function FamilyGroupGoalsSection({ goals }: { goals: DistributorClientGoal[] }) {
  const copy = DISTRIBUTOR_CLIENT_COPY.family;
  const [selectedGoal, setSelectedGoal] = useState<DistributorClientGoal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  if (goals.length === 0) {
    return null;
  }

  return (
    <>
      <section className="distributor-family-group-dashboard__goals">
        <header className="distributor-family-group-dashboard__section-head">
          <h2 className="text-xl font-normal">{copy.goalsSectionTitle}</h2>
        </header>
        <ul className="distributor-family-group-goals-grid">
          {goals.map((goal) => (
            <li key={goal.id}>
              <FamilyGroupGoalTile
                goal={goal}
                onOpenDetails={() => {
                  setSelectedGoal(goal);
                  setDetailOpen(true);
                }}
              />
            </li>
          ))}
        </ul>
      </section>
      <FamilyGroupGoalDetailDialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedGoal(null);
        }}
        goal={selectedGoal}
      />
    </>
  );
}
