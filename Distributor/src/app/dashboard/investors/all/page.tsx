import { redirect } from "next/navigation";

import { SYSTEM_RESIDENT_INVESTORS_HREF } from "@/lib/distributor-client-routes";

export default function AllInvestorsRedirectPage() {
  redirect(SYSTEM_RESIDENT_INVESTORS_HREF);
}
