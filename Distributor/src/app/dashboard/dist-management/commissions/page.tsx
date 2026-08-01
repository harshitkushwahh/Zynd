import { redirect } from "next/navigation";

export default function LegacyBranchCommissionsPage() {
  redirect("/dashboard/dist-management?tab=commissions");
}
