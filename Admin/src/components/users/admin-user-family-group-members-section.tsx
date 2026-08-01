"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Landmark,
  ScrollText,
  UserMinus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { AdminFamilyGroupHeadBadge } from "@/components/users/admin-family-group-head-badge";
import { AdminFamilyGroupRoleBadge } from "@/components/users/admin-family-group-role-badge";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableRows,
  paginateItems,
} from "@/components/ui/admin-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import type {
  AdminFamilyGroupActivity,
  AdminFamilyGroupAnalyticsMember,
  AdminFamilyGroupMfHolding,
} from "@/lib/family-groups-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { formatInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type AdminUserFamilyGroupMembersSectionProps = {
  members: AdminFamilyGroupAnalyticsMember[];
  mfHoldings: AdminFamilyGroupMfHolding[];
  activity: AdminFamilyGroupActivity[];
  groupStatus: string;
  canManageFamilyGroups: boolean;
  focusedMemberId: string | null;
  actionLoading: string | null;
  onRemoveMember: (userId: string, name: string) => void;
};

const ROLE_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: "all", label: "All roles" },
  { value: "head", label: "Head" },
  { value: "member", label: "Member" },
];

function formatActivityEventType(eventType: string) {
  return eventType
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function memberInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function matchesMemberSearch(member: AdminFamilyGroupAnalyticsMember, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    member.display_name,
    member.display_nickname,
    member.email_masked,
    member.role,
    member.badge_label,
  ].some((value) => (value ?? "").toLowerCase().includes(normalized));
}

function matchesActivitySearch(item: AdminFamilyGroupActivity, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    item.message,
    item.event_type,
    formatActivityEventType(item.event_type),
    formatTimestampDetail(item.created_at),
  ].some((value) => value.toLowerCase().includes(normalized));
}

function formatHoldingDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function matchesHoldingSearch(holding: AdminFamilyGroupMfHolding, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    holding.scheme_name,
    holding.matched_scheme_name,
    holding.member_display_name,
    holding.member_label,
    holding.folio_number,
    holding.isin,
    holding.amc_name,
  ].some((value) => (value ?? "").toLowerCase().includes(normalized));
}

const MEMBERS_TABS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "members", label: "Family members", icon: UsersRound },
  { value: "holdings", label: "MF holdings", icon: Landmark },
  { value: "audit", label: "Audit logs", icon: ScrollText },
];

export function AdminUserFamilyGroupMembersSection({
  members,
  mfHoldings,
  activity,
  groupStatus,
  canManageFamilyGroups,
  focusedMemberId,
  actionLoading,
  onRemoveMember,
}: AdminUserFamilyGroupMembersSectionProps) {
  const [activeTab, setActiveTab] = useState("members");
  const [memberSearch, setMemberSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [memberPage, setMemberPage] = useState(0);
  const [holdingsSearch, setHoldingsSearch] = useState("");
  const [holdingsMemberFilter, setHoldingsMemberFilter] = useState("all");
  const [holdingsPage, setHoldingsPage] = useState(0);
  const [auditSearch, setAuditSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [auditPage, setAuditPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  useEffect(() => {
    setMemberPage(0);
  }, [memberSearch, roleFilter]);

  useEffect(() => {
    setHoldingsPage(0);
  }, [holdingsSearch, holdingsMemberFilter]);

  useEffect(() => {
    setAuditPage(0);
  }, [auditSearch, eventFilter]);

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    setMemberPage(0);
    setHoldingsPage(0);
    setAuditPage(0);
  }

  const holdingsMemberOptions = useMemo<AdminSelectOption[]>(() => {
    const seen = new Map<string, string>();
    for (const holding of mfHoldings) {
      if (!seen.has(holding.user_id)) {
        seen.set(holding.user_id, holding.member_display_name);
      }
    }
    return [
      { value: "all", label: "All portfolios" },
      ...[...seen.entries()].map(([userId, label]) => ({ value: userId, label })),
    ];
  }, [mfHoldings]);

  const filteredHoldings = useMemo(
    () =>
      mfHoldings.filter((holding) => {
        if (holdingsMemberFilter !== "all" && holding.user_id !== holdingsMemberFilter) return false;
        return matchesHoldingSearch(holding, holdingsSearch);
      }),
    [holdingsMemberFilter, holdingsSearch, mfHoldings],
  );

  const eventFilterOptions = useMemo<AdminSelectOption[]>(() => {
    const types = [...new Set(activity.map((item) => item.event_type))].sort();
    return [
      { value: "all", label: "All events" },
      ...types.map((type) => ({ value: type, label: formatActivityEventType(type) })),
    ];
  }, [activity]);

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        if (roleFilter !== "all" && member.role !== roleFilter) return false;
        return matchesMemberSearch(member, memberSearch);
      }),
    [members, memberSearch, roleFilter],
  );

  const filteredActivity = useMemo(
    () =>
      activity.filter((item) => {
        if (eventFilter !== "all" && item.event_type !== eventFilter) return false;
        return matchesActivitySearch(item, auditSearch);
      }),
    [activity, auditSearch, eventFilter],
  );

  const memberPagination = useMemo(
    () => paginateItems(filteredMembers, memberPage, pageSize),
    [filteredMembers, memberPage, pageSize],
  );

  const holdingsPagination = useMemo(
    () => paginateItems(filteredHoldings, holdingsPage, pageSize),
    [filteredHoldings, holdingsPage, pageSize],
  );

  const auditPagination = useMemo(
    () => paginateItems(filteredActivity, auditPage, pageSize),
    [auditPage, filteredActivity, pageSize],
  );

  const memberColSpan = canManageFamilyGroups ? 8 : 7;

  const activeMembersTab = MEMBERS_TABS.find((tab) => tab.value === activeTab) ?? MEMBERS_TABS[0];

  return (
    <section className="admin-user-family-group-detail__members-section space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-3">
        <div className="admin-user-family-group-detail__section-head">
          <h2 className="admin-user-family-group-detail__section-title">{activeMembersTab.label}</h2>
          <AdminTabList variant="secondary" className="admin-user-family-group-detail__members-tabs">
            {MEMBERS_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <AdminTabTrigger key={tab.value} value={tab.value} className="gap-2">
                  <Icon className="size-4 shrink-0" />
                  {tab.label}
                </AdminTabTrigger>
              );
            })}
          </AdminTabList>
        </div>

        <TabsContent value="members" className="mt-0 space-y-3">
          <div className="admin-user-family-group-detail__table-toolbar">
            <AdminSearchInput
              containerClassName="admin-user-family-group-detail__table-search"
              placeholder="Search members"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
            />
            <AdminSelect
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={ROLE_FILTER_OPTIONS}
              aria-label="Filter by role"
              triggerClassName="admin-user-family-group-detail__table-filter"
            />
          </div>

          <AdminDataTable
            minWidth="5xl"
            footer={
              <AdminTablePagination
                page={memberPagination.page}
                totalPages={memberPagination.totalPages}
                hasPrevious={memberPagination.hasPrevious}
                hasNext={memberPagination.hasNext}
                totalCount={filteredMembers.length}
                currentPageCount={memberPagination.items.length}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                onPrevious={() => setMemberPage((page) => Math.max(0, page - 1))}
                onNext={() => setMemberPage((page) => page + 1)}
              />
            }
          >
            <AdminTableHeader>
              <AdminTableRow>
                {canManageFamilyGroups ? <AdminTableHeadCell>Actions</AdminTableHeadCell> : null}
                <AdminTableHeadCell>Member</AdminTableHeadCell>
                <AdminTableHeadCell>Role</AdminTableHeadCell>
                <AdminTableHeadCell>Invested</AdminTableHeadCell>
                <AdminTableHeadCell>Goal contribution</AdminTableHeadCell>
                <AdminTableHeadCell>Share</AdminTableHeadCell>
                <AdminTableHeadCell>SIPs</AdminTableHeadCell>
                <AdminTableHeadCell>Joined</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              <AdminTableRows
                colSpan={memberColSpan}
                isEmpty={filteredMembers.length === 0}
                emptyMessage={
                  members.length === 0
                    ? "No active members in this group."
                    : "No members match your search or filters."
                }
              >
                {memberPagination.items.map((member) => (
                  <AdminTableRow
                    key={member.user_id}
                    className={cn(
                      focusedMemberId === member.user_id && "admin-user-family-group-detail__row--focused",
                    )}
                  >
                    {canManageFamilyGroups && groupStatus === "active" && member.role !== "head" ? (
                      <AdminTableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === `remove:${member.user_id}`}
                          onClick={() =>
                            onRemoveMember(
                              member.user_id,
                              member.display_nickname ?? member.display_name,
                            )
                          }
                        >
                          <UserMinus className="size-4" />
                          Remove
                        </Button>
                      </AdminTableCell>
                    ) : canManageFamilyGroups ? (
                      <AdminTableCell>—</AdminTableCell>
                    ) : null}
                    <AdminTableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <Avatar className="size-8">
                            {member.profile_image_url ? (
                              <AvatarImage src={member.profile_image_url} alt="" />
                            ) : null}
                            <AvatarFallback className="text-micro font-semibold">
                              {memberInitials(member.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          {member.role === "head" ? <AdminFamilyGroupHeadBadge /> : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-compact font-medium text-foreground">
                            {member.display_nickname ?? member.display_name}
                          </p>
                          <p className="truncate text-caption text-muted-foreground">{member.email_masked}</p>
                        </div>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <AdminFamilyGroupRoleBadge
                        label={member.role}
                        kind={member.role === "head" ? "head" : "status"}
                      />
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">{formatInr(member.invested_amount_inr)}</AdminTableCell>
                    <AdminTableCell className="tabular-nums">{formatInr(member.goal_contribution_inr)}</AdminTableCell>
                    <AdminTableCell className="tabular-nums">{member.portfolio_share_pct}%</AdminTableCell>
                    <AdminTableCell className="tabular-nums">{member.linked_sip_count}</AdminTableCell>
                    <AdminTableCell>{formatTimestampDetail(member.joined_at)}</AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableRows>
            </AdminTableBody>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="holdings" className="mt-0 space-y-3">
          <div className="admin-user-family-group-detail__table-toolbar">
            <AdminSearchInput
              containerClassName="admin-user-family-group-detail__table-search"
              placeholder="Search holdings"
              value={holdingsSearch}
              onChange={(event) => setHoldingsSearch(event.target.value)}
            />
            <AdminSelect
              value={holdingsMemberFilter}
              onValueChange={setHoldingsMemberFilter}
              options={holdingsMemberOptions}
              aria-label="Filter by portfolio owner"
              triggerClassName="admin-user-family-group-detail__table-filter"
            />
          </div>

          <AdminDataTable
            minWidth="5xl"
            footer={
              <AdminTablePagination
                page={holdingsPagination.page}
                totalPages={holdingsPagination.totalPages}
                hasPrevious={holdingsPagination.hasPrevious}
                hasNext={holdingsPagination.hasNext}
                totalCount={filteredHoldings.length}
                currentPageCount={holdingsPagination.items.length}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                onPrevious={() => setHoldingsPage((page) => Math.max(0, page - 1))}
                onNext={() => setHoldingsPage((page) => page + 1)}
              />
            }
          >
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHeadCell>Scheme</AdminTableHeadCell>
                <AdminTableHeadCell>Portfolio owner</AdminTableHeadCell>
                <AdminTableHeadCell>Folio</AdminTableHeadCell>
                <AdminTableHeadCell>Units</AdminTableHeadCell>
                <AdminTableHeadCell>NAV</AdminTableHeadCell>
                <AdminTableHeadCell>Current value</AdminTableHeadCell>
                <AdminTableHeadCell>As of</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              <AdminTableRows
                colSpan={7}
                isEmpty={filteredHoldings.length === 0}
                emptyMessage={
                  mfHoldings.length === 0
                    ? "No mutual fund holdings linked to this group yet."
                    : "No holdings match your search or filters."
                }
              >
                {holdingsPagination.items.map((holding) => (
                  <AdminTableRow
                    key={`${holding.holding_id}-${holding.isin}-${holding.folio_number}`}
                    className={cn(
                      focusedMemberId === holding.user_id && "admin-user-family-group-detail__row--focused",
                    )}
                  >
                    <AdminTableCell>
                      <div className="min-w-0">
                        <p className="truncate text-compact font-medium text-foreground">
                          {holding.matched_scheme_name ?? holding.scheme_name}
                        </p>
                        {holding.amc_name ? (
                          <p className="truncate text-caption text-muted-foreground">{holding.amc_name}</p>
                        ) : null}
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="min-w-0">
                        <p className="truncate text-compact font-medium text-foreground">
                          {holding.member_display_name}
                        </p>
                        <p className="truncate text-caption text-muted-foreground">
                          {holding.member_label}&apos;s portfolio
                        </p>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums text-muted-foreground">
                      {holding.folio_number || "—"}
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">{holding.units.toLocaleString("en-IN")}</AdminTableCell>
                    <AdminTableCell className="tabular-nums">
                      {holding.nav_value != null ? formatInr(holding.nav_value) : "—"}
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">{formatInr(holding.market_value_inr)}</AdminTableCell>
                    <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                      {formatHoldingDate(holding.as_of_date)}
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableRows>
            </AdminTableBody>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="audit" className="mt-0 space-y-3">
          <div className="admin-user-family-group-detail__table-toolbar">
            <AdminSearchInput
              containerClassName="admin-user-family-group-detail__table-search"
              placeholder="Search audit logs"
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.target.value)}
            />
            <AdminSelect
              value={eventFilter}
              onValueChange={setEventFilter}
              options={eventFilterOptions}
              aria-label="Filter by event type"
              triggerClassName="admin-user-family-group-detail__table-filter"
            />
          </div>

          <AdminDataTable
            minWidth="lg"
            footer={
              <AdminTablePagination
                page={auditPagination.page}
                totalPages={auditPagination.totalPages}
                hasPrevious={auditPagination.hasPrevious}
                hasNext={auditPagination.hasNext}
                totalCount={filteredActivity.length}
                currentPageCount={auditPagination.items.length}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                onPrevious={() => setAuditPage((page) => Math.max(0, page - 1))}
                onNext={() => setAuditPage((page) => page + 1)}
              />
            }
          >
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHeadCell>Event</AdminTableHeadCell>
                <AdminTableHeadCell>Details</AdminTableHeadCell>
                <AdminTableHeadCell>When</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              <AdminTableRows
                colSpan={3}
                isEmpty={filteredActivity.length === 0}
                emptyMessage={
                  activity.length === 0
                    ? "No audit activity recorded for this group yet."
                    : "No audit logs match your search or filters."
                }
              >
                {auditPagination.items.map((item) => (
                  <AdminTableRow key={item.id}>
                    <AdminTableCell>
                      <span className="text-compact font-medium text-foreground">
                        {formatActivityEventType(item.event_type)}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <p className="text-compact text-foreground">{item.message}</p>
                    </AdminTableCell>
                    <AdminTableCell className="whitespace-nowrap">
                      {formatTimestampDetail(item.created_at)}
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableRows>
            </AdminTableBody>
          </AdminDataTable>
        </TabsContent>
      </Tabs>
    </section>
  );
}
