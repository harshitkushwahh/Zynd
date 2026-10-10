import { redirect } from "next/navigation";

export default function SupportAuditLogsRedirectPage() {
  redirect("/dashboard/activity-logs");
}
