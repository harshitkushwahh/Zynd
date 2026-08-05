import { QuickTransactionWizardSkeleton } from "@/components/quick-transaction/quick-transaction-wizard-skeleton";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";

export default function QuickTransactionLoading() {
  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Quick transaction" description="" />
      <QuickTransactionWizardSkeleton />
    </div>
  );
}
