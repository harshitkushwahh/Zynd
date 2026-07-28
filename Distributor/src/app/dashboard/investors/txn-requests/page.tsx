import { redirect } from "next/navigation";

export default function InvestorTxnRequestsRedirectPage() {
  redirect("/dashboard/txn-requests");
}
