import { redirect } from "next/navigation";

import { SYSTEM_RESIDENT_INVESTORS_HREF } from "@/lib/distributor-client-routes";

/** Legacy URL — residential list lives under Investors. */
export default function LegacyYourClientsResidentRedirect() {
  redirect(SYSTEM_RESIDENT_INVESTORS_HREF);
}
