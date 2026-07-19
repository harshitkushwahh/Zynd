import { redirect } from "next/navigation";

export default function TransactionGroupsRedirectPage() {
  redirect("/dashboard/bulk-order/lumpsum");
}
