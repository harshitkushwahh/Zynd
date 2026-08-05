import { GoalDetailPage } from "@/features/goals/components/goal-detail-page";

type DashboardGoalDetailPageProps = {
  params: Promise<{ goalId: string }>;
};

export default async function DashboardGoalDetailPage({ params }: DashboardGoalDetailPageProps) {
  const { goalId } = await params;
  return <GoalDetailPage goalId={goalId} />;
}
