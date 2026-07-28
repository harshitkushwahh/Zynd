import { redirect } from "next/navigation";

import { YOUR_CLIENTS_LIST_HREF } from "@/lib/distributor-client-routes";

export default function LegacyNriSectionRedirect() {
  redirect(YOUR_CLIENTS_LIST_HREF);
}
