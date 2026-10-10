"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DistributorInfoBadge } from "@/components/ui/distributor-info-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  distributorClientDetailHref,
  type DistributorClientListOrigin,
} from "@/lib/distributor-client-routes";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import type {
  DistributorClientFamilyGroup,
  DistributorClientFamilyMember,
} from "@/lib/distributor-types";
import { formatAum } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";

type FamilyGroupMembersTablePanelProps = {
  group: DistributorClientFamilyGroup;
  listOrigin: DistributorClientListOrigin;
  focusedMemberId?: string | null;
};

function memberPortfolioSharePercent(contribution: number, groupTotal: number): number {
  if (groupTotal <= 0) return 0;
  return Math.round((contribution / groupTotal) * 100);
}

type RoleFilter = DistributorClientFamilyMember["role"] | "all";
type BookFilter = "all" | "your-book";

const ROLE_OPTIONS: Array<{ value: DistributorClientFamilyMember["role"]; label: string }> = [
  { value: "head", label: "Group head" },
  { value: "member", label: "Member" },
];

const BOOK_OPTIONS: Array<{ value: "your-book"; label: string }> = [
  { value: "your-book", label: "Your client" },
];

function memberInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function memberEmailDisplay(member: DistributorClientFamilyMember): string {
  if (member.inYourBook && member.contactEmail) return member.contactEmail;
  return member.emailMasked ?? "—";
}

function memberPhoneDisplay(member: DistributorClientFamilyMember): string {
  if (member.inYourBook && member.contactPhone) return member.contactPhone;
  return "—";
}

type MemberTableRow = DistributorClientFamilyMember & {
  email: string;
  phone: string;
  sharePercent: number;
};

function toMemberRow(
  member: DistributorClientFamilyMember,
  groupContributionTotal: number,
): MemberTableRow {
  const contribution = member.portfolioContribution ?? 0;
  return {
    ...member,
    email: memberEmailDisplay(member),
    phone: memberPhoneDisplay(member),
    sharePercent: memberPortfolioSharePercent(contribution, groupContributionTotal),
  };
}

export function FamilyGroupMembersTablePanel({
  group,
  listOrigin,
  focusedMemberId = null,
}: FamilyGroupMembersTablePanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.family;
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [bookFilter, setBookFilter] = useState<BookFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "displayName",
    direction: "ascending",
  });

  const groupContributionTotal = useMemo(
    () => group.members.reduce((sum, member) => sum + (member.portfolioContribution ?? 0), 0),
    [group.members],
  );

  const memberRows = useMemo(
    () => group.members.map((member) => toMemberRow(member, groupContributionTotal)),
    [group.members, groupContributionTotal],
  );

  const filtered = useMemo(() => {
    return memberRows.filter((member) => {
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      if (bookFilter === "your-book" && !member.inYourBook) return false;
      return distributorTableSearchMatch(
        search,
        member.displayName,
        member.email,
        member.phone,
        member.role,
      );
    });
  }, [bookFilter, memberRows, roleFilter, search]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearch("");
        setRoleFilter("all");
        setBookFilter("all");
        setPage(1);
      }}
      clearDisabled={search.trim() === "" && roleFilter === "all" && bookFilter === "all"}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={copy.membersSearchPlaceholder}
          aria-label={copy.membersSearchPlaceholder}
        />
      }
    >
      <StatusFilterSelect
        label={copy.membersRoleFilterLabel}
        value={roleFilter}
        options={ROLE_OPTIONS}
        onValueChange={(value) => {
          setRoleFilter(value);
          setPage(1);
        }}
      />
      <StatusFilterSelect
        label={copy.membersBookFilterLabel}
        value={bookFilter}
        options={BOOK_OPTIONS}
        onValueChange={(value) => {
          setBookFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label={copy.membersTableTitle}
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="displayName" label={copy.membersColumnMember} isRowHeader allowsSorting />
        <Table.Head id="role" label={copy.membersColumnRole} allowsSorting />
        <Table.Head id="email" label={copy.membersColumnEmail} allowsSorting />
        <Table.Head id="phone" label={copy.membersColumnPhone} />
        <Table.Head
          id="portfolioContribution"
          label={copy.membersColumnPortfolioShare}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="sharePercent"
          label={copy.membersColumnSharePercent}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="rowNav"
          label=""
          className="distributor-family-group-members-table__nav-head w-10 min-w-10 max-w-10"
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(member) => {
          const detailHref =
            member.linkedInvestorId && member.inYourBook
              ? distributorClientDetailHref(listOrigin, member.linkedInvestorId)
              : null;

          const isBookClient = Boolean(detailHref);
          const isChartFocused = focusedMemberId === member.userId;

          return (
            <Table.Row
              id={member.userId}
              className={cn(
                isBookClient && "cursor-pointer distributor-family-group-members-table-row--link",
                isChartFocused && "distributor-family-group-members-table-row--focused",
              )}
              {...(isBookClient && detailHref
                ? { onAction: () => router.push(detailHref) }
                : {})}
            >
              <Table.Cell>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar className="size-9 shrink-0">
                    {member.profileImageUrl ? (
                      <AvatarImage src={member.profileImageUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="text-caption font-semibold">
                      {memberInitials(member.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-compact font-medium text-foreground">
                      {member.displayName}
                    </p>
                    {member.inYourBook ? (
                      <DistributorInfoBadge label={copy.yourClientBadge} className="mt-1 max-w-full" />
                    ) : null}
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <StatusBadge variant={member.role === "head" ? "info" : "neutral"}>
                  {member.role === "head" ? "Group head" : "Member"}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell className="max-w-[14rem] truncate text-muted-foreground">
                {member.email}
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap text-muted-foreground">
                {member.phone}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums">
                {formatAum(member.portfolioContribution ?? 0)}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums text-muted-foreground">
                {member.sharePercent}%
              </Table.Cell>
              <Table.Cell className="distributor-family-group-members-table__nav-cell w-10 min-w-10 max-w-10 text-right">
                {isBookClient ? (
                  <ChevronRight
                    className="ml-auto size-4 text-muted-foreground/70"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                ) : null}
              </Table.Cell>
            </Table.Row>
          );
        }}
      </Table.Body>
    </Table>,
  );

  return (
    <section className="distributor-family-group-dashboard__members">
      <h2 className="distributor-family-group-dashboard__members-title text-xl font-normal">
        {copy.membersTableTitle}
      </h2>
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle={copy.membersEmptyFiltered}
        emptyDescription={DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription}
      >
        {table}
      </DistributorTableOnlyShell>
    </section>
  );
}
