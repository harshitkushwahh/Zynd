"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

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
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminDialogFooterActions,
  AdminFormDialog,
} from "@/components/ui/admin-dialog-presets";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAdminPermission,
  type AdminPermission,
} from "@/lib/admin-api";
import {
  PERMISSION_ROUTE_MATRIX,
  permissionDescription,
  type PermissionRouteEntry,
} from "@/lib/admin-permissions-meta";
import { ApiError } from "@/lib/api-client";

type PermissionsCatalogPanelProps = {
  permissionCatalog: AdminPermission[];
  loading: boolean;
  error: string;
  onPermissionCreated: (permission: AdminPermission) => void;
};

type StatusFilter = "all" | PermissionRouteEntry["status"] | "catalog";


function permissionResource(key: string) {
  return key.split(".")[0] ?? key;
}

function matrixEntryFor(key: string): PermissionRouteEntry | undefined {
  return PERMISSION_ROUTE_MATRIX.find((item) => item.permission === key);
}

function statusVariant(status: PermissionRouteEntry["status"] | undefined) {
  if (status === "enforced") return "success" as const;
  if (status === "partial") return "warning" as const;
  if (status === "mismatch") return "destructive" as const;
  return "neutral" as const;
}

function permissionStatus(key: string): StatusFilter {
  const matrix = matrixEntryFor(key);
  return matrix?.status ?? "catalog";
}

function AddPermissionDialog({
  open,
  saving,
  error,
  onClose,
  onCreate,
}: {
  open: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onCreate: (payload: { key: string; description: string }) => void;
}) {
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setKey("");
    setDescription("");
  }, [open]);

  if (!open) return null;

  return (
    <AdminFormDialog
      open={open}
      onClose={onClose}
      title="Add permission"
      description="Create a custom permission key for team roles."
      icon={KeyRound}
      iconTone="info"
      size="md"
      footer={
        <AdminDialogFooterActions
          cancelLabel="Cancel"
          confirmLabel="Add permission"
          loading={saving}
          loadingLabel="Adding..."
          confirmDisabled={!key.trim() || !description.trim()}
          onCancel={onClose}
          onConfirm={() =>
            onCreate({
              key: key.trim().toLowerCase(),
              description: description.trim(),
            })
          }
        />
      }
    >
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="permission-key">Permission key</Label>
          <Input
            id="permission-key"
            placeholder="area.action"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="permission-description">Description</Label>
          <Input
            id="permission-description"
            placeholder="What does this allow?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>
    </AdminFormDialog>
  );
}

export function PermissionsCatalogPanel({
  permissionCatalog,
  loading,
  error,
  onPermissionCreated,
}: PermissionsCatalogPanelProps) {
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const areaOptions = useMemo<AdminSelectOption[]>(() => {
    const areas = new Set(permissionCatalog.map((item) => permissionResource(item.key)));
    return [
      { value: "all", label: "All areas" },
      ...[...areas]
        .sort((a, b) => a.localeCompare(b))
        .map((area) => ({ value: area, label: area })),
    ];
  }, [permissionCatalog]);

  const statusOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "all", label: "All statuses" },
      { value: "enforced", label: "enforced" },
      { value: "partial", label: "partial" },
      { value: "mismatch", label: "mismatch" },
      { value: "catalog", label: "catalog" },
    ],
    [],
  );

  const filteredPermissions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return [...permissionCatalog]
      .sort((a, b) => a.key.localeCompare(b.key))
      .filter((item) => {
        if (areaFilter !== "all" && permissionResource(item.key) !== areaFilter) {
          return false;
        }

        const status = permissionStatus(item.key);
        if (statusFilter !== "all" && status !== statusFilter) {
          return false;
        }

        if (!normalized) return true;

        const matrix = matrixEntryFor(item.key);
        return (
          item.key.toLowerCase().includes(normalized) ||
          item.description.toLowerCase().includes(normalized) ||
          matrix?.routes.some((route) => route.toLowerCase().includes(normalized)) === true
        );
      });
  }, [areaFilter, permissionCatalog, query, statusFilter]);

  useEffect(() => {
    setPage(0);
  }, [query, areaFilter, statusFilter, pageSize]);

  const pagination = useMemo(
    () => paginateItems(filteredPermissions, page, pageSize),
    [filteredPermissions, page, pageSize],
  );

  const handleCreatePermission = async (payload: { key: string; description: string }) => {
    setCreating(true);
    setDialogError("");
    try {
      const created = await createAdminPermission(payload);
      onPermissionCreated(created);
      setDialogOpen(false);
    } catch (err) {
      setDialogError(getErrorMessage(err, "Could not create permission."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminSearchInput
            containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
            placeholder="Search permissions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <AdminSelect
              value={areaFilter}
              onValueChange={setAreaFilter}
              options={areaOptions}
              placeholder="Area"
              className="min-w-select-sm"
              triggerClassName="w-auto"
            />
            <AdminSelect
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              options={statusOptions}
              placeholder="Status"
              className="min-w-select-sm"
              triggerClassName="w-auto"
            />
            <Button
              onClick={() => {
                setDialogError("");
                setDialogOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Add permission
            </Button>
          </div>
        </div>

        {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

        <AdminDataTable
          minWidth="sm"
          footer={
            <AdminTablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              hasPrevious={pagination.hasPrevious}
              hasNext={pagination.hasNext}
              disabled={loading}
              totalCount={filteredPermissions.length}
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
              <AdminTableHeadCell>Permission</AdminTableHeadCell>
              <AdminTableHeadCell>Description</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeletonRows columns={3} />
            ) : filteredPermissions.length === 0 ? (
              <AdminTableStateRow colSpan={3}>No permissions match your filters.</AdminTableStateRow>
            ) : (
              pagination.items.map((item) => {
                const matrix = matrixEntryFor(item.key);
                const status = permissionStatus(item.key);
                return (
                  <AdminTableRow key={item.key}>
                    <AdminTableCell>
                      <p className="font-medium text-foreground">{item.key}</p>
                      <p className="mt-0.5 text-caption capitalize text-muted-foreground">
                        {permissionResource(item.key)}
                      </p>
                    </AdminTableCell>
                    <AdminTableCell className="text-muted-foreground">
                      {item.description || permissionDescription(item.key)}
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant={statusVariant(matrix?.status)} showIcon={false}>
                        {status}
                      </StatusBadge>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminDataTable>
      </div>

      <AddPermissionDialog
        open={dialogOpen}
        saving={creating}
        error={dialogError}
        onClose={() => {
          setDialogOpen(false);
          setDialogError("");
        }}
        onCreate={(payload) => void handleCreatePermission(payload)}
      />
    </>
  );
}
