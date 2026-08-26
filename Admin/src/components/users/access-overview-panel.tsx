"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, Shield, X } from "lucide-react";

import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
  paginateItems,
} from "@/components/ui/admin-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { Button } from "@/components/ui/button";
import {
  groupCapabilityKeys,
  orphanCapabilities,
} from "@/lib/admin-capabilities";
import { getRoleCoverage } from "@/lib/admin-role-display";
import type { AdminPermission, AdminRole } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

type AccessOverviewPanelProps = {
  roles: AdminRole[];
  permissionCatalog: AdminPermission[];
};

function getRoleAreas(role: AdminRole) {
  return groupCapabilityKeys(role.permissions).filter((group) => group.enabledCount > 0);
}

function buildRoleGroups(
  role: AdminRole,
  permissionCatalog: AdminPermission[],
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  const groups = groupCapabilityKeys(role.permissions);
  const custom = orphanCapabilities(role.permissions, permissionCatalog);

  const mapped = groups
    .map((group) => {
      const filteredCapabilities = group.capabilities.filter((capability) => {
        if (!normalized) return true;
        return (
          capability.label.toLowerCase().includes(normalized) ||
          capability.description.toLowerCase().includes(normalized) ||
          group.label.toLowerCase().includes(normalized)
        );
      });

      return {
        ...group,
        capabilities: filteredCapabilities,
        totalCount: group.capabilities.length,
      };
    })
    .filter((group) => group.capabilities.length > 0);

  if (custom.length > 0 && (!normalized || "custom".includes(normalized))) {
    mapped.push({
      id: "custom",
      label: "Custom access",
      description: "Permissions outside the standard capability groups.",
      capabilities: custom.map((item) => ({ ...item, enabled: true })),
      enabledCount: custom.length,
      totalCount: custom.length,
    });
  }

  return mapped;
}

function CapabilityRow({
  label,
  description,
  enabled,
}: {
  label: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-control)] border px-3 py-2.5",
        enabled ? "border-success/20 bg-success/5" : "border-border/70 bg-muted/10",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {enabled ? <Check className="size-3" /> : <X className="size-3" />}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-compact font-medium",
            enabled ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <span className="block text-caption text-muted-foreground">{description}</span>
      </span>
    </div>
  );
}

function CapabilityGroupPanel({
  label,
  description,
  enabledCount,
  totalCount,
  capabilities,
}: {
  label: string;
  description: string;
  enabledCount: number;
  totalCount: number;
  capabilities: Array<{
    key: string;
    label: string;
    description: string;
    enabled: boolean;
  }>;
}) {
  const progress = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;

  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      <div className="shrink-0 border-b border-border bg-muted/15 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-compact font-semibold text-foreground">{label}</h3>
            <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
          </div>
          <StatusBadge variant={enabledCount > 0 ? "success" : "neutral"} showIcon={false}>
            {enabledCount}/{totalCount}
          </StatusBadge>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              enabledCount > 0 ? "bg-success" : "bg-muted-foreground/30",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="max-h-scroll-md space-y-2 overflow-y-auto p-4">
        {capabilities.map((capability) => (
          <CapabilityRow
            key={capability.key}
            label={capability.label}
            description={capability.description}
            enabled={capability.enabled}
          />
        ))}
      </div>
    </section>
  );
}

function RoleAccessDetailDialog({
  role,
  permissionCatalog,
  open,
  onClose,
}: {
  role: AdminRole | null;
  permissionCatalog: AdminPermission[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open, role?.key]);

  const grouped = useMemo(() => {
    if (!role) return [];
    return buildRoleGroups(role, permissionCatalog, query);
  }, [permissionCatalog, query, role]);

  const coveragePercent = role ? getRoleCoverage(role) : 0;

  if (!open || !role) return null;

  return (
    <AdminDetailDialog
      open={open}
      onClose={onClose}
      title={role.name}
      description={`${role.description} · ${coveragePercent}% of standard catalog`}
      icon={Shield}
      iconTone="info"
      size="xl"
      bodyClassName="max-h-dialog-body-wide space-y-0 p-0"
    >
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <StatusBadge variant={role.is_system ? "neutral" : "info"} showIcon={false}>
          {role.is_system ? "Built-in" : "Custom"}
        </StatusBadge>
        <StatusBadge variant="success" showIcon={false}>
          {role.permissions.length} enabled
        </StatusBadge>
      </div>

      <div className="border-b border-border px-5 py-3">
        <AdminSearchInput
          containerClassName="max-w-md"
          placeholder="Search capabilities"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="px-5 py-5">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center rounded-card border border-dashed border-border px-6 py-empty-state-md text-center">
            <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
              <Search className="size-6" />
            </div>
            <p className="mt-3 text-compact font-semibold text-foreground">No matching capabilities</p>
            <p className="mt-1 max-w-sm text-caption text-muted-foreground">
              Try another search term to filter this role&apos;s access.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {grouped.map((group) => (
              <CapabilityGroupPanel
                key={group.id}
                label={group.label}
                description={group.description}
                enabledCount={group.enabledCount}
                totalCount={group.totalCount}
                capabilities={group.capabilities}
              />
            ))}
          </div>
        )}
      </div>
    </AdminDetailDialog>
  );
}

export function AccessOverviewPanel({ roles, permissionCatalog }: AccessOverviewPanelProps) {
  const [roleQuery, setRoleQuery] = useState("");
  const [detailRole, setDetailRole] = useState<AdminRole | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
    [roles],
  );

  const filteredRoles = useMemo(() => {
    const query = roleQuery.trim().toLowerCase();
    if (!query) return sortedRoles;

    return sortedRoles.filter((role) => {
      const areas = getRoleAreas(role);
      const haystack = [
        role.name,
        role.key,
        role.description,
        role.is_system ? "built-in" : "custom",
        ...areas.map((area) => area.label),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [roleQuery, sortedRoles]);

  useEffect(() => {
    setPage(0);
  }, [roleQuery, pageSize]);

  const pagination = useMemo(
    () => paginateItems(filteredRoles, page, pageSize),
    [filteredRoles, page, pageSize],
  );

  const openRoleDetail = (role: AdminRole) => {
    setDetailRole(role);
  };

  const closeRoleDetail = () => {
    setDetailRole(null);
  };

  if (sortedRoles.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-border px-6 py-empty-state-lg text-center">
        <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
          <Shield className="size-6" />
        </div>
        <p className="mt-3 text-compact font-semibold text-foreground">No roles to preview</p>
        <p className="mt-1 max-w-sm text-caption text-muted-foreground">
          Create a team role first to review its access footprint here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search roles"
          value={roleQuery}
          onChange={(event) => setRoleQuery(event.target.value)}
        />

        <AdminDataTable
          footer={
            <AdminTablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              hasPrevious={pagination.hasPrevious}
              hasNext={pagination.hasNext}
              totalCount={filteredRoles.length}
              currentPageCount={pagination.items.length}
              pageSize={pageSize}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(0);
              }}
              onPrevious={() => setPage((value) => Math.max(0, value - 1))}
              onNext={() => setPage((value) => value + 1)}
            />
          }
        >
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Role</AdminTableHeadCell>
              <AdminTableHeadCell>Type</AdminTableHeadCell>
              <AdminTableHeadCell>Capabilities</AdminTableHeadCell>
              <AdminTableHeadCell>Coverage</AdminTableHeadCell>
              <AdminTableHeadCell>Access areas</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {filteredRoles.length === 0 ? (
              <AdminTableStateRow colSpan={5}>No roles match your search.</AdminTableStateRow>
            ) : (
              pagination.items.map((role) => {
                const areas = getRoleAreas(role);
                const coverage = getRoleCoverage(role);

                return (
                  <AdminTableRow key={role.key} onClick={() => openRoleDetail(role)}>
                    <AdminTableCell>
                        <p className="font-medium text-foreground">{role.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">
                          {role.description}
                        </p>
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant={role.is_system ? "neutral" : "info"} showIcon={false}>
                        {role.is_system ? "Built-in" : "Custom"}
                      </StatusBadge>
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant="info" showIcon={false}>
                        {role.permissions.length}
                      </StatusBadge>
                    </AdminTableCell>
                    <AdminTableCell className="text-muted-foreground">{coverage}%</AdminTableCell>
                    <AdminTableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {areas.slice(0, 3).map((area) => (
                            <StatusBadge key={area.id} variant="neutral" showIcon={false}>
                              {area.label}
                            </StatusBadge>
                          ))}
                          {areas.length > 3 ? (
                            <StatusBadge variant="neutral" showIcon={false}>
                              +{areas.length - 3} more
                            </StatusBadge>
                          ) : null}
                        </div>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminDataTable>
      </div>

      <RoleAccessDetailDialog
        role={detailRole}
        permissionCatalog={permissionCatalog}
        open={detailRole != null}
        onClose={closeRoleDetail}
      />
    </>
  );
}
