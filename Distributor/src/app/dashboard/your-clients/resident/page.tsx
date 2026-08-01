import { redirect } from "next/navigation";

import { buildYourClientsListHref } from "@/lib/distributor-clients-list-scope";

/** Legacy URL — platform list lives on Your clients (All investors tab). */
export default function LegacyYourClientsResidentRedirect() {
  redirect(buildYourClientsListHref("all"));
}
