import { redirect } from "next/navigation";

export default function TransactionOpsRedirectPage() {
  redirect("/dashboard/security-config/ops-thresholds");
}
