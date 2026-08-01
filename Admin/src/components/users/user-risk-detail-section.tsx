"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminUserRiskProfileLayout } from "@/components/users/admin-user-risk-profile-layout";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminTableSkeleton } from "@/components/ui/admin-skeletons";
import { getErrorMessage } from "@/lib/errors";
import { ApiError } from "@/lib/api-client";
import {
  fetchUserRiskProfile,
  fetchUserRiskProfileAssessments,
  type UserRiskProfileAssessmentItem,
  type UserRiskProfileDetail,
} from "@/lib/risk-profile-admin-api";

type UserRiskDetailSectionProps = {
  userId: string;
};

export function UserRiskDetailSection({ userId }: UserRiskDetailSectionProps) {
  const [profile, setProfile] = useState<UserRiskProfileDetail | null>(null);
  const [assessments, setAssessments] = useState<UserRiskProfileAssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileResult, assessmentsResult] = await Promise.all([
        fetchUserRiskProfile(userId),
        fetchUserRiskProfileAssessments(userId),
      ]);
      setProfile(profileResult);
      setAssessments(assessmentsResult.items);
    } catch (err) {
      setProfile(null);
      setAssessments([]);
      if (err instanceof ApiError && err.status === 404) {
        setError("");
        return;
      }
      setError(getErrorMessage(err, "Could not load risk profile."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return <AdminTableSkeleton columns={1} rows={4} minWidth="sm" />;
  }

  if (error) {
    return <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>;
  }

  if (!profile) {
    return (
      <p className="text-caption text-muted-foreground">
        This user has not completed a risk profile assessment yet.
      </p>
    );
  }

  return (
    <AdminUserRiskProfileLayout userId={userId} profile={profile} assessments={assessments} />
  );
}
