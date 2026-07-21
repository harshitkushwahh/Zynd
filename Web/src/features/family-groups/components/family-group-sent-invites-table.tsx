"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaginationPageMinimalCenter, Table, TableCard } from "@/components/core/table";
import type { FamilyGroupInvite } from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupSentInvitesEmptyState } from "@/features/family-groups/components/family-group-sent-invites-empty-state";
import { FamilyMemberRoleBadge } from "@/features/family-groups/components/family-member-role-badge";
import { formatFamilyGroupActivityTimestamp } from "@/features/family-groups/lib/family-group-activity-utils";
import { paginateItems } from "@/features/family-groups/lib/family-group-table-pagination";
import { copy } from "@/shared/config/copy";

type FamilyGroupSentInvitesTableProps = {
  invites: FamilyGroupInvite[];
  onRevokeInvite: (invite: FamilyGroupInvite) => void;
};

function inviteStatusBadgeVariant(status: FamilyGroupInvite["status"]) {
  if (status === "accepted") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "revoked" || status === "declined") return "destructive" as const;
  return "outline" as const;
}

function formatInviteStatus(status: FamilyGroupInvite["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function FamilyGroupSentInvitesTable({ invites, onRevokeInvite }: FamilyGroupSentInvitesTableProps) {
  const [page, setPage] = useState(1);

  const sortedInvites = useMemo(
    () =>
      [...invites].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ),
    [invites],
  );

  const pagination = useMemo(() => paginateItems(sortedInvites, page), [page, sortedInvites]);

  useEffect(() => {
    setPage(1);
  }, [invites.length]);

  useEffect(() => {
    if (page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

  return (
    <TableCard.Root>
      <Table aria-label={copy.familyGroups.invite.sentTitle}>
        <Table.Header>
          <Table.Head id="email" label={copy.familyGroups.invite.tableEmail} isRowHeader />
          <Table.Head id="role" label={copy.familyGroups.invite.tableRole} />
          <Table.Head id="sent" label={copy.familyGroups.invite.tableSent} />
          <Table.Head id="expires" label={copy.familyGroups.invite.tableExpires} />
          <Table.Head id="status" label={copy.familyGroups.invite.tableStatus} />
          <Table.Head id="actions" label={copy.familyGroups.invite.tableActions} />
        </Table.Header>
        <Table.Body
          items={pagination.pageItems}
          renderEmptyState={() => <FamilyGroupSentInvitesEmptyState />}
        >
          {(invite) => (
            <Table.Row id={invite.id}>
              <Table.Cell>
                <p className="max-w-[16rem] truncate font-medium text-foreground">
                  {invite.invitee_email ?? copy.familyGroups.invite.linkRecipient}
                </p>
              </Table.Cell>
              <Table.Cell>
                <FamilyMemberRoleBadge role={invite.intended_role} badgeLabel={invite.intended_badge_label} />
              </Table.Cell>
              <Table.Cell>
                <p className="whitespace-nowrap text-caption text-muted-foreground">
                  {formatFamilyGroupActivityTimestamp(invite.created_at)}
                </p>
              </Table.Cell>
              <Table.Cell>
                <p className="whitespace-nowrap text-caption text-muted-foreground">
                  {formatFamilyGroupActivityTimestamp(invite.expires_at)}
                </p>
              </Table.Cell>
              <Table.Cell>
                <Badge variant={inviteStatusBadgeVariant(invite.status)}>{formatInviteStatus(invite.status)}</Badge>
              </Table.Cell>
              <Table.Cell>
                <div className="flex flex-wrap gap-2">
                  {invite.status === "pending" && invite.share_url ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(invite.share_url ?? "");
                      }}
                    >
                      {copy.familyGroups.invite.copyLink}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={invite.status !== "pending"}
                    onClick={() => onRevokeInvite(invite)}
                  >
                    {copy.familyGroups.invite.withdraw}
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
      {sortedInvites.length > 0 ? (
        <PaginationPageMinimalCenter
          page={pagination.page}
          total={pagination.totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </TableCard.Root>
  );
}
