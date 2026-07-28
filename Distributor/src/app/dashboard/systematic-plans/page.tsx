import { SystematicPlansPanel } from "@/components/systematic-plans/systematic-plans-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function SystematicPlansPage() {
  return <SystematicPlansPanel {...DISTRIBUTOR_PAGE_CONFIG.systematicPlans} />;
}
