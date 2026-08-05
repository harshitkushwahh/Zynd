import type { DistributorTxnRequest } from "@/lib/dummy/types";

export const DUMMY_TXN_REQUESTS: DistributorTxnRequest[] = [
  {
    id: "txn-001",
    requestRef: "TXR-90014",
    investorEmailMasked: "vi*******41@gmail.com",
    clientCode: "ZYD0000193",
    requestType: "Purchase",
    amount: 5000,
    status: "Pending",
    createdAt: "2026-07-22T10:05:00.000Z",
  },
  {
    id: "txn-002",
    requestRef: "TXR-90013",
    investorEmailMasked: "mo********ews@gmail.com",
    clientCode: "ZYD0000191",
    requestType: "SIP Register",
    amount: 2000,
    status: "Pending",
    createdAt: "2026-07-21T15:40:00.000Z",
  },
  {
    id: "txn-003",
    requestRef: "TXR-90012",
    investorEmailMasked: "k*******n6@gmail.com",
    clientCode: "ZYD0000187",
    requestType: "Redeem",
    amount: 250,
    status: "Approved",
    createdAt: "2026-07-19T09:12:00.000Z",
  },
  {
    id: "txn-004",
    requestRef: "TXR-90011",
    investorEmailMasked: "pr*************yani@gmail.com",
    clientCode: "ZYD0000183",
    requestType: "Folio Update",
    amount: null,
    status: "Rejected",
    createdAt: "2026-07-18T18:22:00.000Z",
  },
  {
    id: "txn-005",
    requestRef: "TXR-90010",
    investorEmailMasked: "ta******io@proton.me",
    clientCode: "ZYD0000176",
    requestType: "Purchase",
    amount: 10000,
    status: "Pending",
    createdAt: "2026-07-17T07:55:00.000Z",
  },
];

export const DUMMY_PLATFORM_TXN_REQUESTS: DistributorTxnRequest[] = [
  {
    id: "txn-p-001",
    requestRef: "TXR-89901",
    investorEmailMasked: "s*****ha@yahoo.com",
    clientCode: "ZYD0000138",
    requestType: "Purchase",
    amount: 3500,
    status: "Pending",
    createdAt: "2026-07-23T14:20:00.000Z",
    inDistributorBook: false,
  },
  {
    id: "txn-p-002",
    requestRef: "TXR-89900",
    investorEmailMasked: "m****ni@proton.me",
    clientCode: "ZYD0000115",
    requestType: "SIP Register",
    amount: 1200,
    status: "Approved",
    createdAt: "2026-07-20T11:00:00.000Z",
    inDistributorBook: false,
  },
];

export type TxnRequestsListScope = "your-book" | "all";

export function getTxnRequestsForListScope(
  requests: DistributorTxnRequest[],
  scope: TxnRequestsListScope,
): DistributorTxnRequest[] {
  const book = requests.filter((request) => request.inDistributorBook !== false);
  if (scope === "all") {
    return [...book, ...DUMMY_PLATFORM_TXN_REQUESTS];
  }
  return book;
}
