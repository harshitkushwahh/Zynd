import type {
  DistributorClientDocument,
  DistributorClientKycStep,
  DistributorInvestor,
} from "@/lib/dummy/types";

function stepById(steps: DistributorClientKycStep[], id: string) {
  return steps.find((step) => step.id === id);
}

function docFromStep(
  investor: DistributorInvestor,
  step: DistributorClientKycStep | undefined,
  config: {
    id: string;
    label: string;
    category: DistributorClientDocument["category"];
    filePrefix: string;
    identifierMasked?: string | null;
    uploadedOffsetDays: number;
  },
): DistributorClientDocument {
  const completed = step?.status === "completed";
  const skipped = step?.status === "not_applicable";
  const createdMs = new Date(investor.createdAt).getTime();

  if (skipped) {
    return {
      id: config.id,
      category: config.category,
      label: config.label,
      fileName: null,
      identifierMasked: config.identifierMasked ?? null,
      uploadedAt: null,
      status: "not_required",
      source: "KRA path",
    };
  }

  if (!completed) {
    return {
      id: config.id,
      category: config.category,
      label: config.label,
      fileName: null,
      identifierMasked: config.identifierMasked ?? null,
      uploadedAt: null,
      status: "missing",
      source: "KYC journey",
    };
  }

  const uploadedAt = new Date(
    createdMs + config.uploadedOffsetDays * 86400000,
  ).toISOString();

  return {
    id: config.id,
    category: config.category,
    label: config.label,
    fileName: `${config.filePrefix}-${investor.clientCode.toLowerCase()}.pdf`,
    identifierMasked: config.identifierMasked ?? null,
    uploadedAt,
    status: "uploaded",
    source: "KYC journey",
  };
}

export function buildClientDocumentsForInvestor(
  investor: DistributorInvestor,
  kycSteps: DistributorClientKycStep[],
): DistributorClientDocument[] {
  const panStep = stepById(kycSteps, "pan");
  const addressStep = stepById(kycSteps, "address");
  const bankStep = stepById(kycSteps, "bank");
  const signatureStep = stepById(kycSteps, "signature");

  const documents: DistributorClientDocument[] = [
    docFromStep(investor, panStep, {
      id: "doc-pan",
      label: "PAN card",
      category: "pan",
      filePrefix: "pan",
      identifierMasked: investor.panMasked,
      uploadedOffsetDays: 1,
    }),
    docFromStep(investor, addressStep, {
      id: "doc-address",
      label: "Address proof",
      category: "address_proof",
      filePrefix: "address-proof",
      uploadedOffsetDays: 3,
    }),
    docFromStep(investor, bankStep, {
      id: "doc-bank",
      label: "Bank proof",
      category: "bank_proof",
      filePrefix: "bank-proof",
      uploadedOffsetDays: 5,
    }),
    docFromStep(investor, signatureStep, {
      id: "doc-signature",
      label: "Signature",
      category: "signature",
      filePrefix: "signature",
      uploadedOffsetDays: 6,
    }),
  ];

  return documents;
}
