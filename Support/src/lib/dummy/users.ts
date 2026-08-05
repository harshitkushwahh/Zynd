export type SupportUserKycStatus = "verified" | "pending" | "rejected" | "not_started";

export type SupportEndUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: SupportUserKycStatus;
  city: string;
  joinedAt: string;
  openTickets: number;
  lastActiveAt: string;
};

export const DUMMY_USERS: SupportEndUser[] = [
  {
    id: "usr-1001",
    name: "Priya Nair",
    email: "priya.nair@example.com",
    phone: "+91 98765 41001",
    kycStatus: "verified",
    city: "Bengaluru",
    joinedAt: "2026-01-12T10:00:00.000Z",
    openTickets: 1,
    lastActiveAt: "2026-07-24T18:20:00.000Z",
  },
  {
    id: "usr-1002",
    name: "Arjun Desai",
    email: "arjun.desai@example.com",
    phone: "+91 98200 22011",
    kycStatus: "pending",
    city: "Mumbai",
    joinedAt: "2026-03-04T08:30:00.000Z",
    openTickets: 2,
    lastActiveAt: "2026-07-24T16:05:00.000Z",
  },
  {
    id: "usr-1003",
    name: "Meera Iyer",
    email: "meera.iyer@example.com",
    phone: "+91 99887 66110",
    kycStatus: "verified",
    city: "Chennai",
    joinedAt: "2025-11-20T14:15:00.000Z",
    openTickets: 0,
    lastActiveAt: "2026-07-23T11:40:00.000Z",
  },
  {
    id: "usr-1004",
    name: "Kabir Singh",
    email: "kabir.singh@example.com",
    phone: "+91 90112 33445",
    kycStatus: "rejected",
    city: "Delhi",
    joinedAt: "2026-05-18T09:00:00.000Z",
    openTickets: 1,
    lastActiveAt: "2026-07-24T09:12:00.000Z",
  },
  {
    id: "usr-1005",
    name: "Sana Qureshi",
    email: "sana.q@example.com",
    phone: "+91 97654 88990",
    kycStatus: "not_started",
    city: "Hyderabad",
    joinedAt: "2026-07-01T12:45:00.000Z",
    openTickets: 1,
    lastActiveAt: "2026-07-24T20:01:00.000Z",
  },
  {
    id: "usr-1006",
    name: "Rohan Kapoor",
    email: "rohan.kapoor@example.com",
    phone: "+91 98111 55667",
    kycStatus: "verified",
    city: "Pune",
    joinedAt: "2026-02-08T07:20:00.000Z",
    openTickets: 0,
    lastActiveAt: "2026-07-22T15:30:00.000Z",
  },
];

export function getDummyUser(id: string): SupportEndUser | undefined {
  return DUMMY_USERS.find((user) => user.id === id);
}
