"use client";

import Link from "next/link";
import { Building2, IndianRupee, Mail, MapPin, Phone, Repeat, TrendingUp, UserRound, Users2 } from "lucide-react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DUMMY_STATE_HEAD, type DistributorHeadDistributor } from "@/lib/dummy/distributor-head-data";
import type { DistributorBookSummary } from "@/lib/distributor-head-queries";
import { distributorHeadManagerHref } from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadCount, formatDistributorHeadInr } from "@/lib/distributor-head-format";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

type DistributorHeadDistributorHeroSectionProps = {
  distributor: DistributorHeadDistributor;
  book: DistributorBookSummary;
  managerName: string;
  managerId: string;
};

export function DistributorHeadDistributorHeroSection({
  distributor,
  book,
  managerName,
  managerId,
}: DistributorHeadDistributorHeroSectionProps) {
  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5">
          <Avatar className="size-14 shrink-0 rounded-xl">
            <AvatarFallback className="rounded-xl text-lg font-semibold">
              {initialsFromName(distributor.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-semibold text-foreground">{distributor.name}</h2>
              <DistributorHeadStatusBadge status={distributor.status} />
            </div>
            <p className="font-mono text-compact text-muted-foreground">{distributor.arn}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1 font-normal">
                <Mail className="size-3 opacity-70" />
                {distributor.email}
              </Badge>
              {distributor.mobile ? (
                <Badge variant="outline" className="gap-1 font-normal">
                  <Phone className="size-3 opacity-70" />
                  {distributor.mobile}
                </Badge>
              ) : null}
              <Badge variant="outline" className="gap-1 font-normal">
                <MapPin className="size-3 opacity-70" />
                {distributor.branchName}
                {distributor.city ? ` · ${distributor.city}` : ""}
              </Badge>
              {distributor.euin ? (
                <Badge variant="secondary" className="font-normal">
                  EUIN {distributor.euin}
                </Badge>
              ) : null}
              <Badge variant="outline" className="font-normal">
                Reports to{" "}
                <Link
                  href={distributorHeadManagerHref(managerId)}
                  className="ml-1 text-primary underline-offset-4 hover:underline"
                >
                  {managerName}
                </Link>
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <AdminMetricCardsGrid>
        <AdminMetricCard
          label="Book AUM"
          value={formatDistributorHeadInr(book.totalAumInr)}
          hint="Mark-to-market demo value"
          icon={IndianRupee}
          tone="success"
          accent
        />
        <AdminMetricCard
          label="Active SIPs"
          value={formatDistributorHeadCount(book.activeSipCount)}
          hint={`${formatDistributorHeadInr(book.sipCommitmentMonthlyInr)}/mo commitment`}
          icon={Repeat}
          tone="info"
        />
        <AdminMetricCard
          label="Lumpsum MTD"
          value={formatDistributorHeadInr(book.lumpsumMtdInr)}
          hint={`SIP MTD ${formatDistributorHeadInr(book.sipMtdInr)}`}
          icon={IndianRupee}
          tone="default"
        />
        <AdminMetricCard
          label="Investor clients"
          value={formatDistributorHeadCount(book.totalClients)}
          hint={
            distributor.onboardingCompletePct != null
              ? `${distributor.onboardingCompletePct}% onboarded`
              : "Active relationships on Zynd"
          }
          icon={Users2}
          tone="muted"
        />
        <AdminMetricCard
          label="Sales MTD"
          value={formatDistributorHeadInr(book.salesMtdInr)}
          hint={
            distributor.salesYtdInr
              ? `YTD ${formatDistributorHeadInr(distributor.salesYtdInr)}`
              : "Flows attributed this month"
          }
          icon={TrendingUp}
          tone="default"
        />
        <AdminMetricCard
          label="Branch"
          value={distributor.branchName}
          hint="Primary office for client meetings"
          icon={Building2}
          tone="info"
        />
      </AdminMetricCardsGrid>
    </div>
  );
}

export function DistributorHeadDistributorReportingLine({
  distributor,
  managerName,
  managerId,
}: {
  distributor: DistributorHeadDistributor;
  managerName: string;
  managerId: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <p className="text-base font-semibold text-foreground">Reporting line</p>
        <ol className="space-y-3 text-compact">
          <li className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
            <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">{DUMMY_STATE_HEAD.name}</p>
              <p className="text-caption text-muted-foreground">
                {MITRA_HIERARCHY_COPY.stateHead} · {DUMMY_STATE_HEAD.state}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2.5">
            <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <Link
                href={distributorHeadManagerHref(managerId)}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {managerName}
              </Link>
              <p className="text-caption text-muted-foreground">
                {MITRA_HIERARCHY_COPY.branchManager} · coaches this {MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 rounded-md border border-primary/25 bg-primary/5 px-3 py-2.5">
            <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">{distributor.name}</p>
              <p className="text-caption text-muted-foreground">
                {MITRA_HIERARCHY_COPY.zyndMitra} · client acquisition & order placement
              </p>
            </div>
          </li>
        </ol>
        <p className="text-caption text-muted-foreground">
          Day to day, {distributor.name} executes transactions for investors at{" "}
          <span className="font-medium text-foreground">{distributor.branchName}</span>. {managerName}{" "}
          reviews pipeline, leave, and onboarding; {DUMMY_STATE_HEAD.name} sees aggregated sales and AUM
          for {DUMMY_STATE_HEAD.state}.
        </p>
      </CardContent>
    </Card>
  );
}
