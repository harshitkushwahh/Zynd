export type DistributorHeadManager = {
  id: string;
  name: string;
  email: string;
  city: string;
  branchIds: string[];
  distributorCount: number;
  salesMtdInr: number;
  salesYtdInr: number;
  status: "Active" | "On leave";
};

export type DistributorHeadBranch = {
  id: string;
  name: string;
  city: string;
  managerId: string;
  managerName: string;
  distributorCount: number;
  activeClients: number;
  aumInr: number;
  salesMtdInr: number;
};

export type DistributorHeadDistributor = {
  id: string;
  name: string;
  email: string;
  arn: string;
  managerId: string;
  managerName: string;
  branchId: string;
  branchName: string;
  clientCount: number;
  aumInr: number;
  salesMtdInr: number;
  status: "Active" | "Onboarding" | "Suspended";
  mobile?: string;
  euin?: string;
  city?: string;
  joinedAt?: string;
  salesYtdInr?: number;
  activeSipCount?: number;
  onboardingCompletePct?: number;
};

export type DistributorHeadSalesRow = {
  id: string;
  periodLabel: string;
  lumpsumInr: number;
  sipInr: number;
  totalInr: number;
  transactionCount: number;
};

export const DUMMY_STATE_HEAD = {
  id: "sh-mh-1",
  name: "Priya Kulkarni",
  email: "priya.kulkarni@zynd.distributor",
  state: "Maharashtra",
  stateCode: "MH",
  roleLabel: "Mitra State Head",
} as const;

export const DUMMY_MANAGERS: DistributorHeadManager[] = [
  {
    id: "mgr-1",
    name: "Amit Shah",
    email: "amit.shah@zynd.distributor",
    city: "Pune",
    branchIds: ["br-pune", "br-pcmc"],
    distributorCount: 8,
    salesMtdInr: 1_42_00_000,
    salesYtdInr: 18_60_00_000,
    status: "Active",
  },
  {
    id: "mgr-2",
    name: "Neha Patil",
    email: "neha.patil@zynd.distributor",
    city: "Mumbai",
    branchIds: ["br-andheri", "br-thane"],
    distributorCount: 11,
    salesMtdInr: 2_08_00_000,
    salesYtdInr: 24_10_00_000,
    status: "Active",
  },
  {
    id: "mgr-3",
    name: "Rahul Deshmukh",
    email: "rahul.d@zynd.distributor",
    city: "Nagpur",
    branchIds: ["br-nagpur"],
    distributorCount: 5,
    salesMtdInr: 68_50_000,
    salesYtdInr: 9_20_00_000,
    status: "Active",
  },
  {
    id: "mgr-4",
    name: "Sneha Rao",
    email: "sneha.rao@zynd.distributor",
    city: "Nashik",
    branchIds: ["br-nashik"],
    distributorCount: 4,
    salesMtdInr: 41_20_000,
    salesYtdInr: 5_75_00_000,
    status: "On leave",
  },
];

export const DUMMY_BRANCHES: DistributorHeadBranch[] = [
  {
    id: "br-andheri",
    name: "Andheri West",
    city: "Mumbai",
    managerId: "mgr-2",
    managerName: "Neha Patil",
    distributorCount: 6,
    activeClients: 842,
    aumInr: 42_50_00_000,
    salesMtdInr: 1_12_00_000,
  },
  {
    id: "br-thane",
    name: "Thane",
    city: "Mumbai NCR",
    managerId: "mgr-2",
    managerName: "Neha Patil",
    distributorCount: 5,
    activeClients: 610,
    aumInr: 28_10_00_000,
    salesMtdInr: 96_00_000,
  },
  {
    id: "br-pune",
    name: "Koregaon Park",
    city: "Pune",
    managerId: "mgr-1",
    managerName: "Amit Shah",
    distributorCount: 5,
    activeClients: 520,
    aumInr: 22_40_00_000,
    salesMtdInr: 88_00_000,
  },
  {
    id: "br-pcmc",
    name: "PCMC",
    city: "Pune",
    managerId: "mgr-1",
    managerName: "Amit Shah",
    distributorCount: 3,
    activeClients: 288,
    aumInr: 11_80_00_000,
    salesMtdInr: 54_00_000,
  },
  {
    id: "br-nagpur",
    name: "Civil Lines",
    city: "Nagpur",
    managerId: "mgr-3",
    managerName: "Rahul Deshmukh",
    distributorCount: 5,
    activeClients: 410,
    aumInr: 16_20_00_000,
    salesMtdInr: 68_50_000,
  },
  {
    id: "br-nashik",
    name: "College Road",
    city: "Nashik",
    managerId: "mgr-4",
    managerName: "Sneha Rao",
    distributorCount: 4,
    activeClients: 195,
    aumInr: 7_60_00_000,
    salesMtdInr: 41_20_000,
  },
];

export const DUMMY_DISTRIBUTORS: DistributorHeadDistributor[] = [
  {
    id: "dist-1",
    name: "Riya Mehta",
    email: "riya@zynd.distributor",
    arn: "ARN-884120",
    managerId: "mgr-2",
    managerName: "Neha Patil",
    branchId: "br-andheri",
    branchName: "Andheri West",
    clientCount: 128,
    aumInr: 4_82_00_000,
    salesMtdInr: 28_50_000,
    status: "Active",
    mobile: "+91 98201 44780",
    euin: "E884120",
    city: "Mumbai",
    joinedAt: "2024-03-12",
    salesYtdInr: 2_14_00_000,
    activeSipCount: 86,
    onboardingCompletePct: 94,
  },
  {
    id: "dist-2",
    name: "Vikram Singh",
    email: "vikram@zynd.distributor",
    arn: "ARN-884019",
    managerId: "mgr-1",
    managerName: "Amit Shah",
    branchId: "br-pune",
    branchName: "Koregaon Park",
    clientCount: 76,
    aumInr: 2_15_00_000,
    salesMtdInr: 18_20_000,
    status: "Active",
  },
  {
    id: "dist-3",
    name: "Karan Joshi",
    email: "karan.j@zynd.distributor",
    arn: "ARN-884332",
    managerId: "mgr-2",
    managerName: "Neha Patil",
    branchId: "br-thane",
    branchName: "Thane",
    clientCount: 94,
    aumInr: 3_10_00_000,
    salesMtdInr: 22_40_000,
    status: "Active",
  },
  {
    id: "dist-4",
    name: "Ananya Iyer",
    email: "ananya.i@zynd.distributor",
    arn: "ARN-884401",
    managerId: "mgr-3",
    managerName: "Rahul Deshmukh",
    branchId: "br-nagpur",
    branchName: "Civil Lines",
    clientCount: 52,
    aumInr: 1_85_00_000,
    salesMtdInr: 12_60_000,
    status: "Active",
  },
  {
    id: "dist-5",
    name: "Mohit Agarwal",
    email: "mohit.a@zynd.distributor",
    arn: "ARN-884512",
    managerId: "mgr-1",
    managerName: "Amit Shah",
    branchId: "br-pcmc",
    branchName: "PCMC",
    clientCount: 18,
    aumInr: 42_00_000,
    salesMtdInr: 4_80_000,
    status: "Onboarding",
  },
  {
    id: "dist-6",
    name: "Pooja Nair",
    email: "pooja.n@zynd.distributor",
    arn: "ARN-884601",
    managerId: "mgr-4",
    managerName: "Sneha Rao",
    branchId: "br-nashik",
    branchName: "College Road",
    clientCount: 61,
    aumInr: 1_12_00_000,
    salesMtdInr: 9_10_000,
    status: "Active",
  },
  {
    id: "dist-7",
    name: "Deepak Verma",
    email: "deepak.v@zynd.distributor",
    arn: "ARN-884702",
    managerId: "mgr-2",
    managerName: "Neha Patil",
    branchId: "br-andheri",
    branchName: "Andheri West",
    clientCount: 0,
    aumInr: 0,
    salesMtdInr: 0,
    status: "Suspended",
  },
];

export const DUMMY_SALES_ROWS: DistributorHeadSalesRow[] = [
  {
    id: "sales-jul",
    periodLabel: "Jul 2026 (MTD)",
    lumpsumInr: 2_84_00_000,
    sipInr: 1_75_70_000,
    totalInr: 4_59_70_000,
    transactionCount: 1_842,
  },
  {
    id: "sales-jun",
    periodLabel: "Jun 2026",
    lumpsumInr: 3_12_00_000,
    sipInr: 1_68_40_000,
    totalInr: 4_80_40_000,
    transactionCount: 1_956,
  },
  {
    id: "sales-may",
    periodLabel: "May 2026",
    lumpsumInr: 2_95_50_000,
    sipInr: 1_62_10_000,
    totalInr: 4_57_60_000,
    transactionCount: 1_788,
  },
  {
    id: "sales-apr",
    periodLabel: "Apr 2026",
    lumpsumInr: 3_08_20_000,
    sipInr: 1_59_80_000,
    totalInr: 4_68_00_000,
    transactionCount: 1_801,
  },
];

export type DistributorHeadLeaveApplication = {
  id: string;
  applicantName: string;
  applicantRole: "Manager" | "Distributor";
  branchName: string;
  city: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: "Pending" | "Approved" | "Rejected";
  submittedAt: string;
  reason: string;
};

export const DUMMY_LEAVE_APPLICATIONS: DistributorHeadLeaveApplication[] = [
  {
    id: "leave-1",
    applicantName: "Sneha Rao",
    applicantRole: "Manager",
    branchName: "College Road",
    city: "Nashik",
    leaveType: "Annual leave",
    startDate: "2026-07-28",
    endDate: "2026-08-08",
    days: 10,
    status: "Pending",
    submittedAt: "2026-07-25T09:12:00.000Z",
    reason: "Family travel — handover to deputy manager.",
  },
  {
    id: "leave-2",
    applicantName: "Mohit Agarwal",
    applicantRole: "Distributor",
    branchName: "PCMC",
    city: "Pune",
    leaveType: "Sick leave",
    startDate: "2026-07-29",
    endDate: "2026-07-31",
    days: 3,
    status: "Pending",
    submittedAt: "2026-07-28T06:40:00.000Z",
    reason: "Medical rest per clinic note.",
  },
  {
    id: "leave-3",
    applicantName: "Pooja Nair",
    applicantRole: "Distributor",
    branchName: "College Road",
    city: "Nashik",
    leaveType: "Casual leave",
    startDate: "2026-08-02",
    endDate: "2026-08-02",
    days: 1,
    status: "Pending",
    submittedAt: "2026-07-27T14:20:00.000Z",
    reason: "Personal errand.",
  },
  {
    id: "leave-4",
    applicantName: "Karan Joshi",
    applicantRole: "Distributor",
    branchName: "Thane",
    city: "Mumbai NCR",
    leaveType: "Annual leave",
    startDate: "2026-07-10",
    endDate: "2026-07-14",
    days: 5,
    status: "Approved",
    submittedAt: "2026-07-01T11:00:00.000Z",
    reason: "Short break after quarter close.",
  },
  {
    id: "leave-5",
    applicantName: "Vikram Singh",
    applicantRole: "Distributor",
    branchName: "Koregaon Park",
    city: "Pune",
    leaveType: "Unpaid leave",
    startDate: "2026-07-20",
    endDate: "2026-07-22",
    days: 3,
    status: "Rejected",
    submittedAt: "2026-07-15T08:55:00.000Z",
    reason: "Overlap with branch onboarding week.",
  },
];

export function sumManagersSalesMtd() {
  return DUMMY_MANAGERS.reduce((sum, row) => sum + row.salesMtdInr, 0);
}

export function sumBranchesAum() {
  return DUMMY_BRANCHES.reduce((sum, row) => sum + row.aumInr, 0);
}

export type DistributorHeadManagerClient = {
  id: string;
  managerId: string;
  distributorId: string;
  distributorName: string;
  branchName: string;
  name: string;
  email: string;
  aumInr: number;
  hasInvested: boolean;
  kycCompliant: boolean;
  status: "Active" | "Inactive";
};

export type DistributorHeadManagerIncentive = {
  managerId: string;
  periodLabel: string;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  targetSalesInr: number;
  achievedSalesInr: number;
  payoutInr: number;
  attainmentPct: number;
  status: "On track" | "At risk" | "Achieved";
};

export const DUMMY_MANAGER_CLIENTS: DistributorHeadManagerClient[] = [
  {
    id: "mc-1",
    managerId: "mgr-1",
    distributorId: "dist-2",
    distributorName: "Vikram Singh",
    branchName: "Koregaon Park",
    name: "Sanjay Deshpande",
    email: "sanjay.d@example.com",
    aumInr: 18_50_000,
    hasInvested: true,
    kycCompliant: true,
    status: "Active",
  },
  {
    id: "mc-2",
    managerId: "mgr-1",
    distributorId: "dist-2",
    distributorName: "Vikram Singh",
    branchName: "Koregaon Park",
    name: "Meera Kulkarni",
    email: "meera.k@example.com",
    aumInr: 42_00_000,
    hasInvested: true,
    kycCompliant: true,
    status: "Active",
  },
  {
    id: "mc-3",
    managerId: "mgr-1",
    distributorId: "dist-2",
    distributorName: "Vikram Singh",
    branchName: "Koregaon Park",
    name: "Arjun Patel",
    email: "arjun.p@example.com",
    aumInr: 8_20_000,
    hasInvested: true,
    kycCompliant: false,
    status: "Active",
  },
  {
    id: "mc-4",
    managerId: "mgr-1",
    distributorId: "dist-5",
    distributorName: "Mohit Agarwal",
    branchName: "PCMC",
    name: "Nisha Sharma",
    email: "nisha.s@example.com",
    aumInr: 12_00_000,
    hasInvested: true,
    kycCompliant: true,
    status: "Active",
  },
  {
    id: "mc-5",
    managerId: "mgr-1",
    distributorId: "dist-5",
    distributorName: "Mohit Agarwal",
    branchName: "PCMC",
    name: "Rohit Banerjee",
    email: "rohit.b@example.com",
    aumInr: 0,
    hasInvested: false,
    kycCompliant: true,
    status: "Active",
  },
  {
    id: "mc-6",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    branchName: "Andheri West",
    name: "Kavita Menon",
    email: "kavita.m@example.com",
    aumInr: 28_00_000,
    hasInvested: true,
    kycCompliant: true,
    status: "Active",
  },
  {
    id: "mc-7",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    branchName: "Andheri West",
    name: "Rajesh Nair",
    email: "rajesh.n@example.com",
    aumInr: 52_00_000,
    hasInvested: true,
    kycCompliant: true,
    status: "Active",
  },
  {
    id: "mc-8",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    branchName: "Andheri West",
    name: "Priya Shah",
    email: "priya.sh@example.com",
    aumInr: 18_50_000,
    hasInvested: true,
    kycCompliant: false,
    status: "Active",
  },
  {
    id: "mc-9",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    branchName: "Andheri West",
    name: "Amit Desai",
    email: "amit.d@example.com",
    aumInr: 0,
    hasInvested: false,
    kycCompliant: true,
    status: "Active",
  },
  {
    id: "mc-10",
    managerId: "mgr-2",
    distributorId: "dist-3",
    distributorName: "Karan Joshi",
    branchName: "Thane",
    name: "Sunita Rao",
    email: "sunita.r@example.com",
    aumInr: 22_00_000,
    hasInvested: true,
    kycCompliant: true,
    status: "Active",
  },
];

export const DUMMY_MANAGER_INCENTIVES: DistributorHeadManagerIncentive[] = [
  {
    managerId: "mgr-1",
    periodLabel: "Jul 2026 (Q2 close)",
    tier: "Gold",
    targetSalesInr: 1_35_00_000,
    achievedSalesInr: 1_42_00_000,
    payoutInr: 2_85_000,
    attainmentPct: 105,
    status: "Achieved",
  },
  {
    managerId: "mgr-2",
    periodLabel: "Jul 2026 (Q2 close)",
    tier: "Platinum",
    targetSalesInr: 1_95_00_000,
    achievedSalesInr: 2_08_00_000,
    payoutInr: 4_20_000,
    attainmentPct: 107,
    status: "Achieved",
  },
  {
    managerId: "mgr-3",
    periodLabel: "Jul 2026 (Q2 close)",
    tier: "Silver",
    targetSalesInr: 72_00_000,
    achievedSalesInr: 68_50_000,
    payoutInr: 95_000,
    attainmentPct: 95,
    status: "At risk",
  },
  {
    managerId: "mgr-4",
    periodLabel: "Jul 2026 (Q2 close)",
    tier: "Bronze",
    targetSalesInr: 48_00_000,
    achievedSalesInr: 41_20_000,
    payoutInr: 0,
    attainmentPct: 86,
    status: "At risk",
  },
];

export type DistributorHeadBookSipPlan = {
  id: string;
  managerId: string;
  distributorId: string;
  distributorName: string;
  clientName: string;
  schemeName: string;
  amountInr: number;
  frequency: "monthly" | "weekly";
  status: "active" | "paused" | "cancelled";
  nextInstallmentDate: string;
};

export type DistributorHeadBookPurchase = {
  id: string;
  managerId: string;
  distributorId: string;
  distributorName: string;
  clientName: string;
  schemeName: string;
  amountInr: number;
  orderDate: string;
  status: "completed" | "pending" | "failed";
};

export type DistributorHeadManagerAuditLog = {
  id: string;
  managerId: string;
  distributorId?: string;
  actorType: "manager" | "distributor" | "system";
  actorName: string;
  eventType: string;
  summary: string;
  createdAt: string;
};

export const DUMMY_MANAGER_BOOK_SIPS: DistributorHeadBookSipPlan[] = [
  {
    id: "sip-m1-1",
    managerId: "mgr-1",
    distributorId: "dist-2",
    distributorName: "Vikram Singh",
    clientName: "Sanjay Deshpande",
    schemeName: "HDFC Flexi Cap Fund",
    amountInr: 10_000,
    frequency: "monthly",
    status: "active",
    nextInstallmentDate: "2026-08-05",
  },
  {
    id: "sip-m1-2",
    managerId: "mgr-1",
    distributorId: "dist-2",
    distributorName: "Vikram Singh",
    clientName: "Meera Kulkarni",
    schemeName: "Parag Parikh Flexi Cap",
    amountInr: 25_000,
    frequency: "monthly",
    status: "active",
    nextInstallmentDate: "2026-08-10",
  },
  {
    id: "sip-m1-3",
    managerId: "mgr-1",
    distributorId: "dist-2",
    distributorName: "Vikram Singh",
    clientName: "Arjun Patel",
    schemeName: "Nippon India Small Cap",
    amountInr: 5_000,
    frequency: "monthly",
    status: "paused",
    nextInstallmentDate: "2026-08-15",
  },
  {
    id: "sip-m2-1",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    clientName: "Kavita Menon",
    schemeName: "Axis Bluechip Fund",
    amountInr: 15_000,
    frequency: "monthly",
    status: "active",
    nextInstallmentDate: "2026-08-03",
  },
  {
    id: "sip-m2-1b",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    clientName: "Rajesh Nair",
    schemeName: "Mirae Asset Large Cap",
    amountInr: 20_000,
    frequency: "monthly",
    status: "active",
    nextInstallmentDate: "2026-08-07",
  },
  {
    id: "sip-m2-1c",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    clientName: "Priya Shah",
    schemeName: "Parag Parikh Flexi Cap",
    amountInr: 10_000,
    frequency: "monthly",
    status: "paused",
    nextInstallmentDate: "2026-08-12",
  },
  {
    id: "sip-m2-2",
    managerId: "mgr-2",
    distributorId: "dist-3",
    distributorName: "Karan Joshi",
    clientName: "Rajesh Nair",
    schemeName: "ICICI Pru Balanced Advantage",
    amountInr: 8_000,
    frequency: "monthly",
    status: "active",
    nextInstallmentDate: "2026-08-08",
  },
  {
    id: "sip-m4-1",
    managerId: "mgr-4",
    distributorId: "dist-6",
    distributorName: "Pooja Nair",
    clientName: "Nisha Sharma",
    schemeName: "SBI Magnum Midcap",
    amountInr: 12_000,
    frequency: "monthly",
    status: "active",
    nextInstallmentDate: "2026-08-12",
  },
];

export const DUMMY_MANAGER_BOOK_PURCHASES: DistributorHeadBookPurchase[] = [
  {
    id: "pur-m1-1",
    managerId: "mgr-1",
    distributorId: "dist-2",
    distributorName: "Vikram Singh",
    clientName: "Meera Kulkarni",
    schemeName: "Mirae Asset Large Cap",
    amountInr: 2_00_000,
    orderDate: "2026-07-28",
    status: "completed",
  },
  {
    id: "pur-m1-2",
    managerId: "mgr-1",
    distributorId: "dist-2",
    distributorName: "Vikram Singh",
    clientName: "Sanjay Deshpande",
    schemeName: "UTI Nifty 50 Index",
    amountInr: 50_000,
    orderDate: "2026-07-22",
    status: "completed",
  },
  {
    id: "pur-m1-3",
    managerId: "mgr-1",
    distributorId: "dist-5",
    distributorName: "Mohit Agarwal",
    clientName: "Rohit Banerjee",
    schemeName: "HDFC Short Term Debt",
    amountInr: 1_00_000,
    orderDate: "2026-07-25",
    status: "pending",
  },
  {
    id: "pur-m2-1",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    clientName: "Kavita Menon",
    schemeName: "Kotak Emerging Equity",
    amountInr: 3_50_000,
    orderDate: "2026-07-26",
    status: "completed",
  },
  {
    id: "pur-m2-1b",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    clientName: "Rajesh Nair",
    schemeName: "HDFC Flexi Cap Fund",
    amountInr: 1_25_000,
    orderDate: "2026-07-18",
    status: "completed",
  },
  {
    id: "pur-m2-1c",
    managerId: "mgr-2",
    distributorId: "dist-1",
    distributorName: "Riya Mehta",
    clientName: "Priya Shah",
    schemeName: "Nippon India Small Cap",
    amountInr: 75_000,
    orderDate: "2026-07-30",
    status: "pending",
  },
  {
    id: "pur-m2-2",
    managerId: "mgr-2",
    distributorId: "dist-3",
    distributorName: "Karan Joshi",
    clientName: "Priya Shah",
    schemeName: "DSP Midcap Fund",
    amountInr: 75_000,
    orderDate: "2026-07-20",
    status: "completed",
  },
];

export const DUMMY_MANAGER_AUDIT_LOGS: DistributorHeadManagerAuditLog[] = [
  {
    id: "aud-m1-1",
    managerId: "mgr-1",
    actorType: "manager",
    actorName: "Amit Shah",
    eventType: "leave.approved",
    summary: "Approved sick leave for Mohit Agarwal (3 days)",
    createdAt: "2026-07-28T09:30:00.000Z",
  },
  {
    id: "aud-m1-2",
    managerId: "mgr-1",
    actorType: "distributor",
    actorName: "Vikram Singh",
    eventType: "order.lumpsum",
    summary: "Lumpsum purchase ₹2,00,000 — Mirae Asset Large Cap for Meera Kulkarni",
    createdAt: "2026-07-28T11:15:00.000Z",
  },
  {
    id: "aud-m1-3",
    managerId: "mgr-1",
    actorType: "distributor",
    actorName: "Vikram Singh",
    eventType: "sip.created",
    summary: "New SIP ₹10,000/month — HDFC Flexi Cap for Sanjay Deshpande",
    createdAt: "2026-07-25T14:00:00.000Z",
  },
  {
    id: "aud-m1-4",
    managerId: "mgr-1",
    actorType: "system",
    actorName: "Zynd",
    eventType: "onboarding.started",
    summary: "Mohit Agarwal onboarding initiated at PCMC branch",
    createdAt: "2026-07-20T08:00:00.000Z",
  },
  {
    id: "aud-m2-1",
    managerId: "mgr-2",
    distributorId: "dist-1",
    actorType: "distributor",
    actorName: "Riya Mehta",
    eventType: "order.lumpsum",
    summary: "Lumpsum purchase ₹3,50,000 — Kotak Emerging Equity for Kavita Menon",
    createdAt: "2026-07-26T16:45:00.000Z",
  },
  {
    id: "aud-m2-1b",
    managerId: "mgr-2",
    distributorId: "dist-1",
    actorType: "distributor",
    actorName: "Riya Mehta",
    eventType: "sip.created",
    summary: "New SIP ₹20,000/month — Mirae Asset Large Cap for Rajesh Nair",
    createdAt: "2026-07-24T10:30:00.000Z",
  },
  {
    id: "aud-m2-1c",
    managerId: "mgr-2",
    distributorId: "dist-1",
    actorType: "distributor",
    actorName: "Riya Mehta",
    eventType: "client.onboarded",
    summary: "Onboarded Amit Desai — KYC submitted, awaiting investment",
    createdAt: "2026-07-22T14:15:00.000Z",
  },
  {
    id: "aud-m2-2",
    managerId: "mgr-2",
    actorType: "manager",
    actorName: "Neha Patil",
    eventType: "distributor.suspended",
    summary: "Suspended Deepak Verma — compliance review",
    createdAt: "2026-07-18T10:20:00.000Z",
  },
  {
    id: "aud-m4-1",
    managerId: "mgr-4",
    actorType: "manager",
    actorName: "Sneha Rao",
    eventType: "leave.submitted",
    summary: "Annual leave request submitted (10 days)",
    createdAt: "2026-07-25T09:12:00.000Z",
  },
];

export type DistributorHeadAumTrendPoint = {
  label: string;
  aumInr: number;
};

export type DistributorHeadBookHolding = {
  id: string;
  distributorId: string;
  schemeName: string;
  amcName: string;
  aumInr: number;
  clientCount: number;
  sipSharePct: number;
};

export type DistributorHeadDistributorReportRollup = {
  distributorId: string;
  aumChangeMtdPct: number;
  netSalesMtdInr: number;
  sipInflowMtdInr: number;
  redemptionsMtdInr: number;
  kycPendingCount: number;
  complianceOpenCount: number;
};

export type DistributorHeadWorkAttendanceRow = {
  id: string;
  distributorId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number;
  workType: "Office" | "Client site" | "Home" | null;
  status: "complete" | "partial" | "leave" | "holiday";
};

export type DistributorHeadWorkHours = {
  distributorId: string;
  weekLabel: string;
  totalHours: number;
  targetHours: number;
  trendPct: number;
  avgDailyHours: number;
  overtimeHours: number;
};

export const DUMMY_DISTRIBUTOR_AUM_TREND: Record<string, DistributorHeadAumTrendPoint[]> = {
  "dist-1": [
    { label: "Mar", aumInr: 3_85_00_000 },
    { label: "Apr", aumInr: 4_02_00_000 },
    { label: "May", aumInr: 4_18_00_000 },
    { label: "Jun", aumInr: 4_45_00_000 },
    { label: "Jul", aumInr: 4_72_00_000 },
    { label: "Aug", aumInr: 4_82_00_000 },
  ],
  "dist-2": [
    { label: "Mar", aumInr: 1_72_00_000 },
    { label: "Apr", aumInr: 1_85_00_000 },
    { label: "May", aumInr: 1_92_00_000 },
    { label: "Jun", aumInr: 2_05_00_000 },
    { label: "Jul", aumInr: 2_12_00_000 },
    { label: "Aug", aumInr: 2_15_00_000 },
  ],
};

export const DUMMY_DISTRIBUTOR_BOOK_HOLDINGS: DistributorHeadBookHolding[] = [
  {
    id: "bh-1",
    distributorId: "dist-1",
    schemeName: "Axis Bluechip Fund",
    amcName: "Axis AMC",
    aumInr: 98_00_000,
    clientCount: 42,
    sipSharePct: 68,
  },
  {
    id: "bh-2",
    distributorId: "dist-1",
    schemeName: "Mirae Asset Large Cap",
    amcName: "Mirae Asset",
    aumInr: 72_00_000,
    clientCount: 31,
    sipSharePct: 55,
  },
  {
    id: "bh-3",
    distributorId: "dist-1",
    schemeName: "Kotak Emerging Equity",
    amcName: "Kotak AMC",
    aumInr: 64_00_000,
    clientCount: 18,
    sipSharePct: 22,
  },
  {
    id: "bh-4",
    distributorId: "dist-1",
    schemeName: "Parag Parikh Flexi Cap",
    amcName: "PPFAS",
    aumInr: 48_00_000,
    clientCount: 24,
    sipSharePct: 74,
  },
  {
    id: "bh-5",
    distributorId: "dist-2",
    schemeName: "HDFC Flexi Cap Fund",
    amcName: "HDFC AMC",
    aumInr: 55_00_000,
    clientCount: 28,
    sipSharePct: 62,
  },
];

export const DUMMY_DISTRIBUTOR_REPORT_ROLLUPS: DistributorHeadDistributorReportRollup[] = [
  {
    distributorId: "dist-1",
    aumChangeMtdPct: 2.1,
    netSalesMtdInr: 28_50_000,
    sipInflowMtdInr: 12_40_000,
    redemptionsMtdInr: 3_20_000,
    kycPendingCount: 8,
    complianceOpenCount: 2,
  },
  {
    distributorId: "dist-2",
    aumChangeMtdPct: 1.4,
    netSalesMtdInr: 18_20_000,
    sipInflowMtdInr: 8_60_000,
    redemptionsMtdInr: 1_80_000,
    kycPendingCount: 4,
    complianceOpenCount: 1,
  },
];

export const DUMMY_DISTRIBUTOR_WORK_ATTENDANCE: DistributorHeadWorkAttendanceRow[] = [
  {
    id: "att-1",
    distributorId: "dist-1",
    date: "2026-07-28",
    clockIn: "09:12",
    clockOut: "18:45",
    hours: 8.5,
    workType: "Office",
    status: "complete",
  },
  {
    id: "att-2",
    distributorId: "dist-1",
    date: "2026-07-29",
    clockIn: "10:05",
    clockOut: "17:30",
    hours: 6.5,
    workType: "Client site",
    status: "partial",
  },
  {
    id: "att-3",
    distributorId: "dist-1",
    date: "2026-07-30",
    clockIn: "09:00",
    clockOut: "19:15",
    hours: 9.0,
    workType: "Office",
    status: "complete",
  },
  {
    id: "att-4",
    distributorId: "dist-1",
    date: "2026-07-31",
    clockIn: null,
    clockOut: null,
    hours: 0,
    workType: null,
    status: "leave",
  },
  {
    id: "att-5",
    distributorId: "dist-1",
    date: "2026-08-01",
    clockIn: "09:18",
    clockOut: "18:20",
    hours: 8.0,
    workType: "Office",
    status: "complete",
  },
];

export const DUMMY_DISTRIBUTOR_WORK_HOURS: DistributorHeadWorkHours[] = [
  {
    distributorId: "dist-1",
    weekLabel: "28 Jul – 1 Aug 2026",
    totalHours: 40.5,
    targetHours: 40,
    trendPct: 4.2,
    avgDailyHours: 8.1,
    overtimeHours: 2.5,
  },
  {
    distributorId: "dist-2",
    weekLabel: "28 Jul – 1 Aug 2026",
    totalHours: 38.0,
    targetHours: 40,
    trendPct: -2.1,
    avgDailyHours: 7.6,
    overtimeHours: 0,
  },
];
