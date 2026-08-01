import { redirect } from "next/navigation";

import { buildYourClientsListHref } from "@/lib/distributor-clients-list-scope";

export default function AllInvestorsRedirectPage() {
  redirect(buildYourClientsListHref("all"));
}
