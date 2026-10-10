import type { DistributorInvestor } from "@/lib/distributor-types";
import { formatDistributorDateTime } from "@/lib/format";
import type {
  SupportClientKycRegistrySnapshot,
  SupportKycRegistryRecordVariant,
} from "@/lib/support-client-kyc-registry-model";

function isoOffsetMinutes(base: string, minutes: number): string {
  const date = new Date(base);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function lastUpdatedLabel(updatedAt: string): string {
  return `Last updated ${formatDistributorDateTime(updatedAt)}`;
}

function buildMfInvestmentAccountVariants(
  clientCode: string,
  investorName: string,
  baseTime: string,
): SupportKycRegistryRecordVariant[] {
  const t1 = isoOffsetMinutes(baseTime, 240);
  const t2 = isoOffsetMinutes(baseTime, 180);
  const t3 = isoOffsetMinutes(baseTime, 90);
  const t4 = isoOffsetMinutes(baseTime, 30);

  return [
    {
      id: "mfia-v1",
      label: lastUpdatedLabel(t1),
      updatedAt: t1,
      summaryFields: [
        { label: "Investment account", value: `mfia_${clientCode}` },
        { label: "Holder", value: investorName },
        { label: "Status", value: "Active" },
        { label: "Primary bank", value: "HDFC •••• 7890" },
      ],
      partnerResponse: {
        id: `mfia_${clientCode}`,
        object: "mf_investment_account",
        status: "active",
        primary_investor_id: `inv_${clientCode}`,
        bank_account_id: `bav_${clientCode}`,
        created_at: t2,
        updated_at: t1,
      },
      systemStored: {
        table: "mf_investment_accounts",
        mf_investment_account_id: `mfia_${clientCode}`,
        investor_id: clientCode,
        fp_external_id: `mfia_${clientCode}`,
        status: "active",
        primary_bank_account_id: `bank_${clientCode}_primary`,
        synced_at: t1,
      },
    },
    {
      id: "mfia-v2",
      label: lastUpdatedLabel(t2),
      updatedAt: t2,
      summaryFields: [
        { label: "Investment account", value: `mfia_${clientCode}` },
        { label: "Holder", value: investorName },
        { label: "Status", value: "Pending activation" },
        { label: "Primary bank", value: "HDFC •••• 7890" },
      ],
      partnerResponse: {
        id: `mfia_${clientCode}`,
        object: "mf_investment_account",
        status: "pending",
        primary_investor_id: `inv_${clientCode}`,
        bank_account_id: `bav_${clientCode}_pending`,
        updated_at: t2,
      },
      systemStored: {
        table: "mf_investment_accounts",
        mf_investment_account_id: `mfia_${clientCode}`,
        status: "pending",
        primary_bank_account_id: null,
        synced_at: t2,
      },
    },
    {
      id: "mfia-v3",
      label: lastUpdatedLabel(t3),
      updatedAt: t3,
      summaryFields: [
        { label: "Investment account", value: `mfia_${clientCode}` },
        { label: "Holder", value: investorName },
        { label: "Status", value: "Created" },
        { label: "Primary bank", value: "Not linked" },
      ],
      partnerResponse: {
        id: `mfia_${clientCode}`,
        object: "mf_investment_account",
        status: "created",
        primary_investor_id: `inv_${clientCode}`,
        updated_at: t3,
      },
      systemStored: {
        table: "mf_investment_accounts",
        mf_investment_account_id: `mfia_${clientCode}`,
        status: "created",
        fp_external_id: `mfia_${clientCode}`,
        synced_at: t3,
      },
    },
    {
      id: "mfia-v4",
      label: lastUpdatedLabel(t4),
      updatedAt: t4,
      summaryFields: [
        { label: "Investment account", value: "Not provisioned" },
        { label: "Holder", value: investorName },
        { label: "Status", value: "Not started" },
        { label: "Primary bank", value: "Not linked" },
      ],
      partnerResponse: {
        object: "mf_investment_account",
        status: "not_requested",
      },
      systemStored: {
        table: "mf_investment_accounts",
        mf_investment_account_id: null,
        investor_id: clientCode,
        synced_at: null,
      },
    },
  ];
}

function buildNomineeVariants(clientCode: string, baseTime: string): SupportKycRegistryRecordVariant[] {
  const t1 = isoOffsetMinutes(baseTime, 200);
  const t2 = isoOffsetMinutes(baseTime, 160);
  const t3 = isoOffsetMinutes(baseTime, 120);
  const t4 = isoOffsetMinutes(baseTime, 70);

  return [
    {
      id: "nom-v1",
      label: lastUpdatedLabel(t1),
      updatedAt: t1,
      summaryFields: [
        { label: "Nominees on file", value: "2" },
        { label: "Primary nominee", value: "Priya Sharma (Spouse)" },
        { label: "Total share", value: "100%" },
        { label: "Sync status", value: "Synced" },
      ],
      partnerResponse: {
        object: "nominee_collection",
        investment_account_id: `mfia_${clientCode}`,
        nominees: [
          {
            name: "Priya Sharma",
            relationship: "spouse",
            share_percent: 60,
            document_type: "pan",
            document_number_last4: "9081",
          },
          {
            name: "Rohan Sharma",
            relationship: "son",
            share_percent: 40,
            date_of_birth: "2014-06-12",
            guardian_name: "Priya Sharma",
          },
        ],
        updated_at: t1,
      },
      systemStored: {
        table: "investor_nominees",
        investment_account_id: `mfia_${clientCode}`,
        rows: [
          {
            id: `nom_${clientCode}_1`,
            full_name: "Priya Sharma",
            relationship: "spouse",
            share_percent: 60,
            pan_last4: "9081",
            sync_status: "synced",
            updated_at: t1,
          },
          {
            id: `nom_${clientCode}_2`,
            full_name: "Rohan Sharma",
            relationship: "son",
            share_percent: 40,
            sync_status: "synced",
            updated_at: t1,
          },
        ],
      },
    },
    {
      id: "nom-v2",
      label: lastUpdatedLabel(t2),
      updatedAt: t2,
      summaryFields: [
        { label: "Nominees on file", value: "2" },
        { label: "Primary nominee", value: "Priya Sharma (Spouse)" },
        { label: "Total share", value: "90%" },
        { label: "Sync status", value: "Pending sync" },
      ],
      partnerResponse: {
        object: "nominee_collection",
        investment_account_id: `mfia_${clientCode}`,
        nominees: [
          { name: "Priya Sharma", relationship: "spouse", share_percent: 60 },
          { name: "Rohan Sharma", relationship: "son", share_percent: 30 },
        ],
        validation_errors: [{ field: "share_percent", message: "Total must equal 100" }],
        updated_at: t2,
      },
      systemStored: {
        table: "investor_nominees",
        rows: [
          { id: `nom_${clientCode}_1`, share_percent: 60, sync_status: "pending" },
          { id: `nom_${clientCode}_2`, share_percent: 30, sync_status: "pending" },
        ],
        synced_at: t2,
      },
    },
    {
      id: "nom-v3",
      label: lastUpdatedLabel(t3),
      updatedAt: t3,
      summaryFields: [
        { label: "Nominees on file", value: "1" },
        { label: "Primary nominee", value: "Priya Sharma (Spouse)" },
        { label: "Total share", value: "100%" },
        { label: "Sync status", value: "Draft" },
      ],
      partnerResponse: {
        object: "nominee_collection",
        nominees: [{ name: "Priya Sharma", relationship: "spouse", share_percent: 100 }],
        updated_at: t3,
      },
      systemStored: {
        table: "investor_nominees",
        rows: [{ id: `nom_${clientCode}_1`, full_name: "Priya Sharma", share_percent: 100, sync_status: "draft" }],
        synced_at: t3,
      },
    },
    {
      id: "nom-v4",
      label: lastUpdatedLabel(t4),
      updatedAt: t4,
      summaryFields: [
        { label: "Nominees on file", value: "0" },
        { label: "Primary nominee", value: "Not added" },
        { label: "Total share", value: "0%" },
        { label: "Sync status", value: "Not started" },
      ],
      partnerResponse: {
        object: "nominee_collection",
        nominees: [],
        updated_at: t4,
      },
      systemStored: {
        table: "investor_nominees",
        rows: [],
        synced_at: null,
      },
    },
  ];
}

function buildInvestorProfileVariants(
  clientCode: string,
  investor: DistributorInvestor,
  baseTime: string,
): SupportKycRegistryRecordVariant[] {
  const t1 = isoOffsetMinutes(baseTime, 220);
  const t2 = isoOffsetMinutes(baseTime, 150);
  const t3 = isoOffsetMinutes(baseTime, 95);
  const t4 = isoOffsetMinutes(baseTime, 45);

  return [
    {
      id: "prof-v1",
      label: lastUpdatedLabel(t1),
      updatedAt: t1,
      summaryFields: [
        { label: "FinPrim investor", value: `inv_${clientCode}` },
        { label: "Email", value: investor.emailMasked.replace(/\*/g, "•") },
        { label: "Mobile", value: investor.mobileMasked.replace(/\*/g, "•") },
        { label: "Address city", value: "Bengaluru" },
      ],
      partnerResponse: {
        id: `inv_${clientCode}`,
        object: "investor_profile",
        email: "investor@example.com",
        mobile: "+9198•••••210",
        permanent_address: {
          line1: "12, Lake View Apartments",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
        updated_at: t1,
      },
      systemStored: {
        table: "investor_profiles",
        investor_id: clientCode,
        fp_investor_id: `inv_${clientCode}`,
        email: "investor@example.com",
        mobile_e164: "+919876543210",
        address_json: {
          line1: "12, Lake View Apartments",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
        profile_revision: 4,
        synced_at: t1,
      },
    },
    {
      id: "prof-v2",
      label: lastUpdatedLabel(t2),
      updatedAt: t2,
      summaryFields: [
        { label: "FinPrim investor", value: `inv_${clientCode}` },
        { label: "Email", value: investor.emailMasked.replace(/\*/g, "•") },
        { label: "Mobile", value: investor.mobileMasked.replace(/\*/g, "•") },
        { label: "Address city", value: "Bengaluru" },
      ],
      partnerResponse: {
        id: `inv_${clientCode}`,
        object: "investor_profile",
        email: "investor@example.com",
        mobile: "+9198•••••210",
        permanent_address: { city: "Bengaluru", state: "Karnataka", pincode: "560001" },
        updated_at: t2,
      },
      systemStored: {
        table: "investor_profiles",
        profile_revision: 3,
        address_json: { city: "Bengaluru", state: "Karnataka", pincode: "560001" },
        synced_at: t2,
      },
    },
    {
      id: "prof-v3",
      label: lastUpdatedLabel(t3),
      updatedAt: t3,
      summaryFields: [
        { label: "FinPrim investor", value: `inv_${clientCode}` },
        { label: "Email", value: investor.emailMasked.replace(/\*/g, "•") },
        { label: "Mobile", value: "Pending verification" },
        { label: "Address city", value: "Not captured" },
      ],
      partnerResponse: {
        id: `inv_${clientCode}`,
        object: "investor_profile",
        email: "investor@example.com",
        mobile: null,
        updated_at: t3,
      },
      systemStored: {
        table: "investor_profiles",
        profile_revision: 2,
        mobile_e164: null,
        address_json: null,
        synced_at: t3,
      },
    },
    {
      id: "prof-v4",
      label: lastUpdatedLabel(t4),
      updatedAt: t4,
      summaryFields: [
        { label: "FinPrim investor", value: "Not linked" },
        { label: "Email", value: investor.emailMasked.replace(/\*/g, "•") },
        { label: "Mobile", value: investor.mobileMasked.replace(/\*/g, "•") },
        { label: "Address city", value: "Not captured" },
      ],
      partnerResponse: {
        object: "investor_profile",
        status: "not_created",
      },
      systemStored: {
        table: "investor_profiles",
        fp_investor_id: null,
        profile_revision: 1,
        synced_at: t4,
      },
    },
  ];
}

export function buildSupportClientKycRegistrySnapshot(args: {
  investor: DistributorInvestor;
  kycInitiatedAt: string;
}): SupportClientKycRegistrySnapshot {
  const { investor, kycInitiatedAt } = args;
  const clientCode = investor.clientCode;

  return {
    records: [
      {
        id: "mf_investment_account",
        title: "MF investment account",
        variants: buildMfInvestmentAccountVariants(clientCode, investor.displayName, kycInitiatedAt),
      },
      {
        id: "nominee",
        title: "Nominee",
        variants: buildNomineeVariants(clientCode, kycInitiatedAt),
      },
      {
        id: "investor_profile",
        title: "Investor profile",
        variants: buildInvestorProfileVariants(clientCode, investor, kycInitiatedAt),
      },
    ],
  };
}
