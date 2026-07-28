"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { IndianRupee, Users2 } from "lucide-react";

import { Table, TableCard } from "@/components/application/table";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { DUMMY_BRANCH_DISTRIBUTORS } from "@/lib/dummy/branch-distributors";
import { branchDistributorDetailHref } from "@/lib/dummy/branch-distributor-profile";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { formatAum, formatDistributorDate } from "@/lib/format";

function statusVariant(status: (typeof DUMMY_BRANCH_DISTRIBUTORS)[number]["status"]) {
  if (status === "Active") return "success" as const;
  if (status === "Onboarding") return "warning" as const;
  return "destructive" as const;
}

export function BranchDistributorsPanel({ iconName, title, description }: DistributorPageConfig) {
  const router = useRouter();
  const { branchLabel } = useDistributorAuth();
  const Icon = resolveDistributorPageIcon(iconName);
  const totalAum = useMemo(
    () => DUMMY_BRANCH_DISTRIBUTORS.reduce((sum, row) => sum + row.aum, 0),
    [],
  );
  const activeCount = DUMMY_BRANCH_DISTRIBUTORS.filter((row) => row.status === "Active").length;

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        icon={Icon}
        title={title}
        description={`${description} Scope: ${branchLabel}.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DistributorMetricCard icon={Users2} label="Distributors" value={String(DUMMY_BRANCH_DISTRIBUTORS.length)} hint="In this branch" />
        <DistributorMetricCard icon={Users2} label="Active" value={String(activeCount)} hint="Fully onboarded" />
        <DistributorMetricCard icon={IndianRupee} label="Branch AUM" value={formatAum(totalAum)} hint="Demo aggregate" />
      </div>
      <TableCard.Root>
        <TableCard.Content>
        <Table aria-label="Branch distributors" size="md">
          <Table.Header>
            <Table.Head isRowHeader>Name</Table.Head>
            <Table.Head>Email</Table.Head>
            <Table.Head>ARN</Table.Head>
            <Table.Head>Clients</Table.Head>
            <Table.Head>AUM</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Joined</Table.Head>
          </Table.Header>
          <Table.Body items={DUMMY_BRANCH_DISTRIBUTORS}>
            {(row) => (
              <Table.Row
                key={row.id}
                id={row.id}
                className="cursor-pointer"
                onAction={() => router.push(branchDistributorDetailHref(row.id))}
              >
                <Table.Cell className="font-medium">{row.name}</Table.Cell>
                <Table.Cell>{row.email}</Table.Cell>
                <Table.Cell className="font-mono text-caption">{row.arn}</Table.Cell>
                <Table.Cell>{row.clientCount}</Table.Cell>
                <Table.Cell>{formatAum(row.aum)}</Table.Cell>
                <Table.Cell>
                  <StatusBadge variant={statusVariant(row.status)}>{row.status}</StatusBadge>
                </Table.Cell>
                <Table.Cell>{formatDistributorDate(row.joinedAt)}</Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
        </TableCard.Content>
      </TableCard.Root>
    </div>
  );
}
