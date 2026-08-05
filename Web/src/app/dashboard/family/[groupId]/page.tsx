import { redirect } from "next/navigation";

type DashboardFamilyGroupDetailPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function DashboardFamilyGroupDetailPage({
  params,
}: DashboardFamilyGroupDetailPageProps) {
  const { groupId } = await params;
  redirect(`/dashboard/family?group=${encodeURIComponent(groupId)}`);
}
