import { AddInvestorWizardSkeleton } from "@/components/add-investor/add-investor-wizard-skeleton";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";

export default function AddInvestorLoading() {
  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Add investor" description="" />
      <AddInvestorWizardSkeleton />
    </div>
  );
}
