export type DistributorNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export const DISTRIBUTOR_DUMMY_NOTIFICATIONS: DistributorNotification[] = [
  {
    id: "n1",
    title: "Txn request pending",
    body: "Rajesh Kumar submitted a redemption request for review.",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    read: false,
  },
  {
    id: "n2",
    title: "New investor onboarded",
    body: "Priya Sharma completed KYC and is ready to invest.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    read: false,
  },
  {
    id: "n3",
    title: "SIP installment alert",
    body: "One SIP debit failed — follow up with the investor.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    read: true,
  },
  {
    id: "n4",
    title: "Order settled",
    body: "Lumpsum order #ORD-8842 was marked successful.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    read: true,
  },
];
