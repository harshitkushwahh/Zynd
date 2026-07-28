import { redirect } from "next/navigation";

import {
  DISTRIBUTOR_OPERATIONS_DEFAULT_SECTION,
  distributorOperationsSectionHref,
} from "@/lib/distributor-operations-sections";

export default function YourOperationsIndexPage() {
  redirect(distributorOperationsSectionHref(DISTRIBUTOR_OPERATIONS_DEFAULT_SECTION));
}
