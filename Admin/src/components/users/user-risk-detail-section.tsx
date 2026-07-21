"use client";

import { useCallback, useEffect, useState } from "react";
import { Gauge } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminTableSkeleton } from "@/components/ui/admin-skeletons";
import { getErrorMessage } from "@/lib/errors";
import { ApiError } from "@/lib/api-client";
import { fetchUserRiskProfile, type UserRiskProfileDetail } from "@/lib/risk-profile-admin-api";
import { PROFILE_SECTION_TITLE_CLASS } from "@/components/users/user-profile-typography";

type UserRiskDetailSectionProps = {
  userId: string;
};

export function UserRiskDetailSection({ userId }: UserRiskDetailSectionProps) {
  const [profile, setProfile] = useState<UserRiskProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchUserRiskProfile(userId);
      setProfile(result);
    } catch (err) {
      setProfile(null);
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
    return <AdminTableSkeleton columns={1} rows={3} minWidth="sm" />;
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
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Gauge className="size-5" />
        </div>
        <div>
          <p className={PROFILE_SECTION_TITLE_CLASS}>{profile.tier_config.title}</p>
          <p className="mt-1 text-caption capitalize text-muted-foreground">{profile.tier}</p>
          <p className="mt-3 text-compact text-muted-foreground">{profile.tier_config.message_body}</p>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-caption text-muted-foreground">Score</dt>
          <dd className="text-compact font-medium text-foreground">{profile.score} / 1000</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Score band</dt>
          <dd className="text-compact font-medium text-foreground">
            {profile.tier_config.min_score}–{profile.tier_config.max_score}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Computed</dt>
          <dd className="text-compact text-foreground">
            {profile.computed_at ? new Date(profile.computed_at).toLocaleString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Assessment ID</dt>
          <dd className="font-mono text-caption text-muted-foreground">{profile.assessment_id}</dd>
        </div>
      </dl>
    </div>
  );
}
