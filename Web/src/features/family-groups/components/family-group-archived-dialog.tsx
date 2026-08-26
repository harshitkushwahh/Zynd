"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, UsersRound } from "lucide-react";

import { BrandDialog } from "@/components/ui/brand-dialog";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  fetchArchivedFamilyGroups,
  type FamilyGroupSummary,
} from "@/features/family-groups/api/family-groups-api";
import { formatRelativeActivityTime, FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupArchivedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FamilyGroupArchivedDialog({ open, onOpenChange }: FamilyGroupArchivedDialogProps) {
  const [items, setItems] = useState<FamilyGroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadArchived = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchArchivedFamilyGroups();
      setItems(response.items);
    } catch (loadError) {
      setError(resolveFamilyGroupApiError(loadError, copy.familyGroups.errors.pageLoadFailedTitle));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadArchived();
  }, [loadArchived, open]);

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.familyGroups.detail.archivedTitle}
      maxWidth="lg"
      className="max-w-xl"
    >
      <div className="max-h-[min(24rem,60vh)] overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className={cn("h-[4.5rem] w-full", FAMILY_GROUP_CARD_RADIUS_CLASS)} />
            ))}
          </div>
        ) : error ? (
          <LoadErrorCard
            title={copy.familyGroups.errors.pageLoadFailedTitle}
            description={error}
            retryLabel={copy.familyGroups.errors.retry}
            onRetry={() => void loadArchived()}
          />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Archive className="size-5" strokeWidth={2} />
            </div>
            <p className="mt-4 text-body font-semibold text-foreground">
              {copy.familyGroups.detail.archivedEmptyTitle}
            </p>
            <p className="mt-2 max-w-sm text-compact text-muted-foreground">
              {copy.familyGroups.detail.archivedEmptyDescription}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((group) => (
              <li
                key={group.id}
                className={cn("flex items-center gap-3 border border-border/70 bg-muted/10 px-3 py-3", FAMILY_GROUP_CARD_RADIUS_CLASS)}
              >
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/10">
                  {group.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={group.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    <UsersRound className="size-4" strokeWidth={2} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-caption font-semibold text-foreground">{group.title}</p>
                    <StatusBadge variant="neutral" showIcon={false}>
                      {copy.familyGroups.card.members(group.member_count)}
                    </StatusBadge>
                  </div>
                  {group.description ? (
                    <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{group.description}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {copy.familyGroups.detail.archivedOn(
                      formatRelativeActivityTime(group.archived_at ?? group.updated_at),
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BrandDialog>
  );
}
