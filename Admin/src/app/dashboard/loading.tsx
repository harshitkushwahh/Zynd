import { AdminPageSkeleton } from "@/components/ui/admin-skeletons";

export default function DashboardLoading() {
  return (
    <div className="p-6">
      <AdminPageSkeleton withToolbar withMetrics metricCount={4} tableColumns={6} />
    </div>
  );
}
