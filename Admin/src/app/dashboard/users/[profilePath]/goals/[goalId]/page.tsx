"use client";

import { use } from "react";

import { AdminUserGoalDetailPage } from "@/components/users/admin-user-goal-detail-page";
import { profilePathToClientId } from "@/lib/admin-user-ref";

type UserGoalDetailRoutePageProps = {
  params: Promise<{ profilePath: string; goalId: string }>;
};

export default function UserGoalDetailRoutePage({ params }: UserGoalDetailRoutePageProps) {
  const { profilePath, goalId } = use(params);
  const clientId = profilePathToClientId(profilePath);

  return (
    <AdminUserGoalDetailPage profilePath={profilePath} clientId={clientId} goalId={goalId} />
  );
}
