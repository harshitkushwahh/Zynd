import { redirect } from "next/navigation";

export default function LegacyBranchPerformancePage() {
  redirect("/dashboard/dist-management?tab=performance");
}
