import { redirect } from "next/navigation";

import { portfolioTabHref } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";

export default function TransactionsPage() {
  redirect(portfolioTabHref("transactions"));
}
