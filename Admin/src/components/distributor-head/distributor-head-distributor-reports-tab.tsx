"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, FileText, TrendingUp } from "lucide-react";

import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DistributorHeadDistributorReportRollup } from "@/lib/dummy/distributor-head-data";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";

const REPORT_TEMPLATES = [
  {
    id: "aum-sales",
    name: "AUM & net sales",
    description: "Book AUM, SIP inflow, redemptions, and net sales for the selected period.",
  },
  {
    id: "holdings",
    name: "Holdings statement",
    description: `Scheme-wise AUM and client counts across the ${MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()} book.`,
  },
  {
    id: "sip-book",
    name: "SIP book",
    description: "Active SIPs, instalment amounts, and upcoming debit dates.",
  },
  {
    id: "kyc-pack",
    name: "KYC pending pack",
    description: "Open onboarding cases with stage, age, and client contact details.",
  },
];

export function DistributorHeadDistributorReportsTab({
  rollup,
}: {
  rollup: DistributorHeadDistributorReportRollup | undefined;
}) {
  if (!rollup) {
    return (
      <p className="text-compact text-muted-foreground">
        No report rollup available for this {MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()} in demo data.
      </p>
    );
  }

  const aumTrendUp = rollup.aumChangeMtdPct >= 0;

  return (
    <div className="space-y-6">
      <AdminMetricCardsGrid>
        <AdminMetricCard
          icon={TrendingUp}
          label="AUM change MTD"
          value={`${aumTrendUp ? "+" : ""}${rollup.aumChangeMtdPct}%`}
          hint="Vs last month close"
          tone={aumTrendUp ? "success" : "default"}
          accent
        />
        <AdminMetricCard
          icon={ArrowUpRight}
          label="Net sales MTD"
          value={formatDistributorHeadInr(rollup.netSalesMtdInr)}
          hint={`SIP inflow ${formatDistributorHeadInr(rollup.sipInflowMtdInr)}`}
          tone="info"
        />
        <AdminMetricCard
          icon={ArrowDownRight}
          label="Redemptions MTD"
          value={formatDistributorHeadInr(rollup.redemptionsMtdInr)}
          hint="Outflows from the book"
          tone="muted"
        />
        <AdminMetricCard
          icon={AlertTriangle}
          label="Open items"
          value={String(rollup.kycPendingCount + rollup.complianceOpenCount)}
          hint={`${rollup.kycPendingCount} KYC · ${rollup.complianceOpenCount} compliance`}
          tone="default"
        />
      </AdminMetricCardsGrid>

      <div className="grid gap-3 md:grid-cols-2">
        {REPORT_TEMPLATES.map((template) => (
          <Card key={template.id} className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FileText className="size-4 text-primary" />
                {template.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-caption text-muted-foreground">{template.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="font-normal">
                  PDF
                </Badge>
                <Badge variant="outline" className="font-normal">
                  Excel
                </Badge>
                <Badge variant="secondary" className="font-normal">
                  Demo export
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
