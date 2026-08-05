import { redirect } from "next/navigation";

import {
  distributorOperationsSectionHref,
  isDistributorOperationsSectionId,
} from "@/lib/distributor-operations-sections";
import { getDistributorOperationsDefaultVariantId } from "@/lib/distributor-operations-variants";

type YourOperationsSectionRedirectProps = {
  params: Promise<{ section: string }>;
};

export default async function YourOperationsSectionRedirectPage({
  params,
}: YourOperationsSectionRedirectProps) {
  const { section } = await params;
  if (!isDistributorOperationsSectionId(section)) {
    redirect(distributorOperationsSectionHref("orders"));
  }
  redirect(
    distributorOperationsSectionHref(
      section,
      getDistributorOperationsDefaultVariantId(section),
    ),
  );
}
