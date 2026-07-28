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
  roleLabel: "State Head",
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
