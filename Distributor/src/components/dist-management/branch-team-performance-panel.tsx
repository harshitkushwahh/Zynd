"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BranchInvestorFunnelChart } from "@/components/dist-management/branch-investor-funnel-chart";
import { BranchPerfCardHeader } from "@/components/dist-management/branch-perf-card-header";
import { BranchPerfChartTooltip } from "@/components/dist-management/branch-perf-chart-tooltip";
import { BranchTargetAttainmentCard } from "@/components/dist-management/branch-target-attainment-card";
import { BranchTeamPerformanceMetrics } from "@/components/dist-management/branch-team-performance-metrics";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { Card } from "@/components/ui/card";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  DUMMY_DISTRIBUTOR_TXN_MIX,
} from "@/lib/distributor-branch-team-performance-data";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { formatAum } from "@/lib/format";

const CHART_BAR_HEIGHT = 260;

type MixChartRow = {
  name: string;
  sip: number;
  lumpsum: number;
};

function MixTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const sip = Number(payload.find((p) => p.dataKey === "sip")?.value ?? 0);
  const lumpsum = Number(payload.find((p) => p.dataKey === "lumpsum")?.value ?? 0);
  const total = sip + lumpsum;
  const sipShare = total > 0 ? Math.round((sip / total) * 100) : 0;
  return (
    <BranchPerfChartTooltip
      label={label}
      rows={[
        { label: "SIP", value: formatAum(sip) },
        { label: "Lumpsum", value: formatAum(lumpsum) },
        { label: "SIP share", value: `${sipShare}%` },
      ]}
    />
  );
}

function renderMixTooltip(props: unknown) {
  return <MixTooltip {...(props as Parameters<typeof MixTooltip>[0])} />;
}

export function BranchTeamPerformancePanel({
  title,
  description,
  embedded = false,
}: DistributorPageConfig & { embedded?: boolean }) {
  const { branchLabel } = useDistributorAuth();

  const mixChartData = useMemo<MixChartRow[]>(
    () =>
      DUMMY_DISTRIBUTOR_TXN_MIX.map((row) => ({
        name: row.name.split(" ")[0] ?? row.name,
        sip: row.sipAmount,
        lumpsum: row.lumpsumAmount,
      })),
    [],
  );

  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "min-w-0")}>
      {!embedded ? (
        <DistributorPageHeader
          title={title}
          description={`${description} Scope: ${branchLabel}.`}
        />
      ) : null}

      <BranchTeamPerformanceMetrics />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="branch-perf-card overflow-hidden p-0">
          <BranchPerfCardHeader eyebrow="Gross inflow" title="SIP vs lumpsum mix" />
          <div
            className="branch-perf-chart h-[260px] w-full min-w-0 px-2 pb-2"
            role="img"
            aria-label={ZYND_MITRA_COPY.sipLumpsumAria}
          >
            <ResponsiveContainer width="100%" height={CHART_BAR_HEIGHT} minWidth={0}>
              <BarChart data={mixChartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v) => `${Math.round(Number(v) / 100000)}L`}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip content={renderMixTooltip} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
                <Bar dataKey="sip" stackId="mix" fill="var(--chart-2)" name="SIP" />
                <Bar dataKey="lumpsum" stackId="mix" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Lumpsum" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="branch-perf-legend px-4 pb-4">
            <span className="branch-perf-legend__item">
              <span className="branch-perf-legend__swatch branch-perf-legend__swatch--sip" aria-hidden />
              SIP
            </span>
            <span className="branch-perf-legend__item">
              <span className="branch-perf-legend__swatch branch-perf-legend__swatch--lumpsum" aria-hidden />
              Lumpsum
            </span>
          </div>
        </Card>

        <Card className="branch-perf-card overflow-hidden p-0">
          <BranchPerfCardHeader eyebrow="Last 90 days" title="Investor acquisition funnel" />
          <BranchInvestorFunnelChart />
        </Card>
      </div>

      <BranchTargetAttainmentCard />
    </div>
  );
}
