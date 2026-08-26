"use client";

import Link from "next/link";
import { Gift } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminTableSkeleton } from "@/components/ui/admin-skeletons";
import { Button } from "@/components/ui/button";
import { UserReferralsDetailSection } from "@/components/users/user-referrals-detail-section";
import { useAdminUserReferralsQuery } from "@/hooks/use-admin-user-referrals-query";
import { referralsTabHref, REFERRALS_TABS } from "@/lib/admin-referrals-navigation";
import { profilePathToClientId, userDashboardProfileHref } from "@/lib/admin-user-ref";
import { getErrorMessage } from "@/lib/errors";

type ReferralsReferrerDetailPageProps = {
  profilePath: string;
};

export function ReferralsReferrerDetailPage({ profilePath }: ReferralsReferrerDetailPageProps) {
  const clientId = profilePathToClientId(profilePath);
  const { data, isPending, error: queryError } = useAdminUserReferralsQuery(clientId);
  const showSkeleton = isPending && !data;
  const error = queryError ? getErrorMessage(queryError, "Could not load referrer details.") : "";

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[
        { label: "Platform" },
        { label: "Referrals", href: referralsTabHref(REFERRALS_TABS[0]) },
        { label: data?.user.display_name ?? "Referrer" },
      ]}
      title={data?.user.display_name ?? "Referrer"}
      icon={Gift}
      headerAside={
        data ? (
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href={userDashboardProfileHref(clientId, "referrals")} />}>
            Open user profile
          </Button>
        ) : null
      }
    >
      {showSkeleton ? <AdminTableSkeleton columns={5} rows={4} minWidth="lg" /> : null}
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {!showSkeleton && !error ? <UserReferralsDetailSection userId={clientId} /> : null}
    </AdminSectionPageShell>
  );
}
