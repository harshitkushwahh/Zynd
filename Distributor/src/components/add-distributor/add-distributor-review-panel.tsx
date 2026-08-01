"use client";

import { useMemo } from "react";
import { Building2, FileUp, Home, Landmark, ScanFace } from "lucide-react";

import {
  AddInvestorReviewPanel,
  type AddInvestorReviewItem,
  type AddInvestorReviewSection,
} from "@/components/add-investor/add-investor-review-panel";
import type {
  AddDistributorAddressDraft,
  AddDistributorBankDraft,
  AddDistributorDocumentDraft,
  AddDistributorNameDraft,
} from "@/lib/add-distributor/add-distributor-journey";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type AddDistributorReviewPanelProps = {
  branchLabel: string;
  email: string;
  mobile: string;
  pan: string;
  name: AddDistributorNameDraft;
  bank: AddDistributorBankDraft;
  address: AddDistributorAddressDraft;
  documents: AddDistributorDocumentDraft;
};

function formatFullName(name: AddDistributorNameDraft): string {
  return [name.firstName, name.middleName, name.lastName].filter(Boolean).join(" ").trim();
}

function trimValue(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function maskedAccountNumber(value: string | undefined | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length <= 4) {
    return digits;
  }
  return `****${digits.slice(-4)}`;
}

function formatAddressReviewItems(address: AddDistributorAddressDraft): AddInvestorReviewItem[] {
  const items: AddInvestorReviewItem[] = [
    { label: "Line 1", value: trimValue(address.line1) || "—" },
  ];

  if (trimValue(address.line2)) {
    items.push({ label: "Line 2", value: trimValue(address.line2) });
  }

  items.push(
    { label: "City", value: trimValue(address.city) || "—" },
    { label: "State", value: trimValue(address.state) || "—" },
    { label: "PIN", value: trimValue(address.pincode) || "—" },
    { label: "Country", value: trimValue(address.country) || "—" },
  );

  return items.filter((item) => item.value !== "—");
}

function formatBankReviewItems(bank: AddDistributorBankDraft): AddInvestorReviewItem[] {
  if (!trimValue(bank.bankName) && !trimValue(bank.accountNumber)) {
    return [{ label: "Payout account", value: "Not added", tone: "muted" }];
  }

  const items: AddInvestorReviewItem[] = [
    { label: "Account holder", value: trimValue(bank.accountHolderName) || "—" },
    { label: "Bank", value: trimValue(bank.bankName) || "—" },
  ];

  if (trimValue(bank.branchName)) {
    items.push({ label: "Branch", value: trimValue(bank.branchName) });
  }

  items.push(
    { label: "Account number", value: maskedAccountNumber(bank.accountNumber) },
    { label: "IFSC", value: trimValue(bank.ifsc).toUpperCase() || "—" },
  );

  return items.filter((item) => item.value && item.value !== "—");
}

function formatDocumentReviewItems(documents: AddDistributorDocumentDraft): AddInvestorReviewItem[] {
  return [
    {
      label: "PAN",
      value: documents.panFileName ?? "Not uploaded",
      tone: documents.panFileName ? "success" : "warning",
    },
    {
      label: "Aadhaar",
      value: documents.aadharFileName ?? "Not uploaded",
      tone: documents.aadharFileName ? "success" : "warning",
    },
  ];
}

export function AddDistributorReviewPanel({
  branchLabel,
  email,
  mobile,
  pan,
  name,
  bank,
  address,
  documents,
}: AddDistributorReviewPanelProps) {
  const fullName = formatFullName(name);

  const hero = useMemo(
    () => ({
      name: fullName || ZYND_MITRA_COPY.singular,
      pan: pan.trim().toUpperCase(),
      kycPathLabel: branchLabel,
    }),
    [branchLabel, fullName, pan],
  );

  const sections = useMemo((): AddInvestorReviewSection[] => {
    return [
      {
        id: "branch-contact",
        title: "Branch & contact",
        icon: Building2,
        items: [
          { label: "Branch", value: branchLabel },
          { label: "Email", value: email.trim() },
          { label: "Mobile", value: `+91 ${mobile}` },
        ],
      },
      {
        id: "pan",
        title: "PAN",
        icon: ScanFace,
        items: [{ label: "PAN number", value: pan.trim().toUpperCase() || "—" }],
      },
      {
        id: "bank",
        title: "Bank account",
        icon: Landmark,
        items: formatBankReviewItems(bank),
      },
      {
        id: "address",
        title: "Registered address",
        icon: Home,
        wide: true,
        items: formatAddressReviewItems(address),
      },
      {
        id: "documents",
        title: "KYC documents",
        icon: FileUp,
        wide: true,
        items: formatDocumentReviewItems(documents),
      },
    ];
  }, [address, bank, branchLabel, documents, email, mobile, pan]);

  return <AddInvestorReviewPanel hero={hero} sections={sections} />;
}
