import { redirect } from "next/navigation";

export default function LegacyMfTransactionsRedirect() {
  redirect("/dashboard/orders/purchases");
}
