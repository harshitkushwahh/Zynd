import { TransactionGroupsPanel } from "@/components/transaction-groups/transaction-groups-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function TransactionGroupsPage() {
  return <TransactionGroupsPanel {...DISTRIBUTOR_PAGE_CONFIG.transactionGroups} />;
}
