import { redirect } from "next/navigation";

export default function TransactionOpsRedirectPage() {
  redirect("/dashboard/orders/ops-thresholds");
}
