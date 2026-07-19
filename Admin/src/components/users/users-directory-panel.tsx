"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  getOffsetPage,
} from "@/components/ui/admin-table";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { userInitials } from "@/lib/admin-capabilities";
import { clientIdToProfilePath } from "@/lib/admin-user-ref";
import { fetchAdminUsers, type AdminUserListItem } from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";
import { UserStatusBadge, MfaStatusBadge, KycComplianceBadge } from "@/components/users/user-status-badge";

const ALL = "all";


function roleLabel(role: string) {
  return role === "admin" ? "Admin" : "Customer";
}

type UsersDirectoryPanelProps = Record<string, never>;

export function UsersDirectoryPanel(_props: UsersDirectoryPanelProps) {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [investmentFilter, setInvestmentFilter] = useState(ALL);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await fetchAdminUsers({
        email: emailFilter.trim() || undefined,
        status: statusFilter === ALL ? undefined : statusFilter,
        limit: ADMIN_TABLE_PAGE_SIZE,
        offset,
      });
      const filtered = items.filter((item) => {
        if (roleFilter !== ALL && item.role !== roleFilter) return false;
        if (investmentFilter === "invested" && !item.has_invested) return false;
        if (investmentFilter === "not_invested" && item.has_invested) return false;
        return true;
      });
      setUsers(filtered);
      setHasMore(items.length === ADMIN_TABLE_PAGE_SIZE);
    } catch (err) {
      setUsers([]);
      setError(getErrorMessage(err, "Could not load users."));
    } finally {
      setLoading(false);
    }
  }, [emailFilter, investmentFilter, offset, roleFilter, statusFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSearch = () => {
    if (offset === 0) {
      void loadUsers();
      return;
    }
    setOffset(0);
  };

  const handleOpenProfile = (user: AdminUserListItem) => {
    router.push(`/dashboard/users/${clientIdToProfilePath(user.client_id)}`);
  };

  return (
    <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <AdminSearchInput
            containerClassName="max-w-sm"
            placeholder="Search by email"
            value={emailFilter}
            onChange={(event) => setEmailFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSearch();
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value ?? ALL);
                setOffset(0);
              }}
            >
              <SelectTrigger size="sm" className="min-w-select-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value ?? ALL);
                setOffset(0);
              }}
            >
              <SelectTrigger size="sm" className="min-w-select-sm">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All roles</SelectItem>
                <SelectItem value="user">Customer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={investmentFilter}
              onValueChange={(value) => {
                setInvestmentFilter(value ?? ALL);
                setOffset(0);
              }}
            >
              <SelectTrigger size="sm" className="min-w-select-md">
                <SelectValue placeholder="Investment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All investors</SelectItem>
                <SelectItem value="invested">Invested</SelectItem>
                <SelectItem value="not_invested">Not invested</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={() => void loadUsers()} aria-label="Refresh">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

        <AdminDataTable minWidth="5xl">
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>User</AdminTableHeadCell>
              <AdminTableHeadCell>Email</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
              <AdminTableHeadCell>Role</AdminTableHeadCell>
              <AdminTableHeadCell>Invested</AdminTableHeadCell>
              <AdminTableHeadCell className="text-center">KYC</AdminTableHeadCell>
              <AdminTableHeadCell>Joined</AdminTableHeadCell>
              <AdminTableHeadCell>MFA</AdminTableHeadCell>
              <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeletonRows columns={9} />
            ) : users.length === 0 ? (
              <AdminTableStateRow colSpan={9}>No users match your filters.</AdminTableStateRow>
            ) : (
              users.map((user) => (
                <AdminTableRow key={user.user_id} onClick={() => handleOpenProfile(user)}>
                      <AdminTableCell>
                        <div className="flex items-center gap-3">
                          <Avatar size="sm">
                            <AvatarFallback className="bg-primary/10 text-caption font-medium text-primary">
                              {userInitials(user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{user.display_name}</span>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell className="text-muted-foreground">{user.email}</AdminTableCell>
                      <AdminTableCell>
                        <UserStatusBadge status={user.status} />
                      </AdminTableCell>
                      <AdminTableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {roleLabel(user.role)}
                        </Badge>
                      </AdminTableCell>
                      <AdminTableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.has_invested
                              ? "border-success/30 bg-success/10 text-success"
                              : "text-muted-foreground"
                          }
                        >
                          {user.has_invested ? "Invested" : "Not invested"}
                        </Badge>
                      </AdminTableCell>
                      <AdminTableCell className="text-center">
                        <KycComplianceBadge compliant={user.kyc_compliant} />
                      </AdminTableCell>
                      <AdminTableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </AdminTableCell>
                      <AdminTableCell>
                        <MfaStatusBadge enabled={user.mfa_enrolled} />
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for ${user.email}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenProfile(user)}>
                              View profile
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </AdminTableCell>
                    </AdminTableRow>
                ))
              )}
          </AdminTableBody>
        </AdminDataTable>

        <AdminTablePagination
          page={getOffsetPage(offset)}
          hasPrevious={offset > 0}
          hasNext={hasMore}
          disabled={loading}
          onPrevious={() => setOffset((value) => Math.max(0, value - ADMIN_TABLE_PAGE_SIZE))}
          onNext={() => setOffset((value) => value + ADMIN_TABLE_PAGE_SIZE)}
        />
    </div>
  );
}
