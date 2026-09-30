"use client";

import { Scale } from "lucide-react";

import { AdminUserProfileSectionEmptyState } from "@/components/users/admin-user-profile-section-empty-state";
import { AdminUserRiskProfileLayout } from "@/components/users/admin-user-risk-profile-layout";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminTableSkeleton } from "@/components/ui/admin-skeletons";
import { useAdminUserRiskProfileQuery } from "@/hooks/use-admin-user-risk-profile-query";
import { getErrorMessage } from "@/lib/errors";

type UserRiskDetailSectionProps = {
  userId: string;
};

export function UserRiskDetailSection({ userId }: UserRiskDetailSectionProps) {
  const { data, isPending, error: queryError } = useAdminUserRiskProfileQuery(userId);
  const showSkeleton = isPending && !data;
  const error = queryError ? getErrorMessage(queryError, "Could not load risk profile.") : "";

  if (showSkeleton) {
    return <AdminTableSkeleton columns={1} rows={4} minWidth="sm" />;
  }

  if (error) {
    return <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>;
  }

  if (!data || data.notFound || !data.profile) {
    return (
      <AdminUserProfileSectionEmptyState
        icon={Scale}
        title="No risk profile yet"
        description="This user has not completed a risk profile assessment yet."
      />
    );
  }

  return (
    <AdminUserRiskProfileLayout
      userId={userId}
      profile={data.profile}
      assessments={data.assessments}
    />
  );
}
