import { redirect } from "next/navigation";

export default function LegacyBranchReportsPage() {
  redirect("/dashboard/dist-management?tab=reports");
}
