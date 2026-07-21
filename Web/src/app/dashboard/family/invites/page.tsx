"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  acceptFamilyGroupInviteById,
  declineFamilyGroupInviteById,
  fetchPendingFamilyInvites,
  type PendingFamilyGroupInvite,
} from "@/features/family-groups/api/family-groups-api";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageTitle } from "@/components/ui/page-title";
import { StatusBadge } from "@/components/ui/status-badge";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { parseApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { useRouter } from "next/navigation";

const familyRoute = DASHBOARD_ROUTES.find((route) => route.id === "family-groups")!;

export default function DashboardFamilyInvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<PendingFamilyGroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchPendingFamilyInvites();
      setInvites(response.items);
    } catch (loadError) {
      setError(parseApiError(loadError).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  async function handleAccept(inviteId: string) {
    setSubmittingId(inviteId);
    try {
      const joined = await acceptFamilyGroupInviteById(inviteId);
      router.push(buildFamilyGroupHref(joined.id));
    } catch (acceptError) {
      setError(parseApiError(acceptError).message || copy.familyGroups.join.errors.acceptFailed);
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleDecline(inviteId: string) {
    setSubmittingId(inviteId);
    try {
      await declineFamilyGroupInviteById(inviteId);
      await loadInvites();
    } catch (declineError) {
      setError(parseApiError(declineError).message || copy.familyGroups.join.errors.declineFailed);
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <Breadcrumb className="mb-6 shrink-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/dashboard" />}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/dashboard/family" />}>{familyRoute.label}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{copy.familyGroups.invite.pendingPageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <PageTitle>{copy.familyGroups.invite.pendingPageTitle}</PageTitle>
        <p className="mt-2 max-w-2xl text-compact text-muted-foreground">
          {copy.familyGroups.invite.pendingPageDescription}
        </p>

        {loading ? (
          <p className="mt-6 text-compact text-muted-foreground">{copy.familyGroups.join.loading}</p>
        ) : error ? (
          <LoadErrorCard
            className="mt-6"
            title={copy.familyGroups.errors.pageLoadFailedTitle}
            description={error}
            retryLabel={copy.familyGroups.errors.retry}
            onRetry={() => void loadInvites()}
          />
        ) : invites.length === 0 ? (
          <p className="mt-6 text-compact text-muted-foreground">{copy.familyGroups.invite.pendingEmpty}</p>
        ) : (
          <div className="mt-6 space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-zynd-low"
              >
                <div>
                  <p className="text-caption font-semibold text-foreground">{invite.group_title}</p>
                  <p className="mt-1 text-compact text-muted-foreground">
                    {copy.familyGroups.join.invitedBy(invite.inviter_name)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge variant="neutral" showIcon={false} className="capitalize">
                      {invite.intended_role}
                    </StatusBadge>
                    {invite.intended_badge_label ? (
                      <StatusBadge variant="info" showIcon={false}>
                        {invite.intended_badge_label}
                      </StatusBadge>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submittingId === invite.id}
                    onClick={() => void handleDecline(invite.id)}
                  >
                    {copy.familyGroups.join.decline}
                  </Button>
                  <Button
                    type="button"
                    disabled={submittingId === invite.id}
                    onClick={() => void handleAccept(invite.id)}
                  >
                    {copy.familyGroups.join.accept}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
