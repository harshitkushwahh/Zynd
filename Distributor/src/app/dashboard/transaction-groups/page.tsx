import { redirect } from "next/navigation";

import { distributorOperationsSectionHref } from "@/lib/distributor-operations-sections";

export default function TransactionGroupsPage() {
  redirect(distributorOperationsSectionHref("transaction-groups"));
}
