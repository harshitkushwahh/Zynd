import { redirect } from "next/navigation";

import {
  distributorClientDetailHref,
  YOUR_CLIENTS_LIST_HREF,
} from "@/lib/distributor-client-routes";
import { getInvestorById } from "@/lib/dummy/client-profile";

type LegacyResidentClientDetailProps = {
  params: Promise<{ clientId: string }>;
};

/** Legacy `/your-clients/resident/:id` → book or system detail. */
export default async function LegacyResidentClientDetailRedirect({
  params,
}: LegacyResidentClientDetailProps) {
  const { clientId } = await params;
  const investor = getInvestorById(clientId);
  if (!investor) {
    redirect(YOUR_CLIENTS_LIST_HREF);
  }
  const origin = investor.inDistributorBook ? "your-book" : "system-resident";
  redirect(distributorClientDetailHref(origin, clientId));
}
