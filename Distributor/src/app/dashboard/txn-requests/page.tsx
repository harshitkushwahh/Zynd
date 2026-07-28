import { TxnRequestsPanel } from "@/components/txn-requests/txn-requests-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function TxnRequestsPage() {
  return <TxnRequestsPanel {...DISTRIBUTOR_PAGE_CONFIG.txnRequests} />;
}
