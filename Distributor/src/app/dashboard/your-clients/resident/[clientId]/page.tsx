import { redirect } from "next/navigation";

import {
  distributorClientDetailHref,
  YOUR_CLIENTS_LIST_HREF,
} from "@/lib/distributor-client-routes";

type LegacyResidentClientDetailProps = {
  params: Promise<{ clientId: string }>;
};

/** Legacy `/your-clients/resident/:id` → book detail. */
export default async function LegacyResidentClientDetailRedirect({
  params,
}: LegacyResidentClientDetailProps) {
  const { clientId } = await params;
  if (!clientId) {
    redirect(YOUR_CLIENTS_LIST_HREF);
  }
  redirect(distributorClientDetailHref("your-book", clientId));
}
