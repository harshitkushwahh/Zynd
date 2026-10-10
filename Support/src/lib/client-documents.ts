import type {
  DistributorClientDocument,
  DistributorClientDocumentCategory,
  DistributorClientKycStep,
  DistributorInvestor,
} from "@/lib/distributor-types";

export type ApiKycDocument = {
  id: string;
  doc_type: string;
  status?: string | null;
  created_at?: string | null;
  original_filename?: string | null;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  pan: "PAN card",
  address_proof: "Address proof",
  aadhaar: "Aadhaar",
  bank_statement: "Bank proof",
  signature: "Signature",
  nominee_id: "Nominee ID",
};

const DOC_TYPE_TO_CATEGORY: Record<string, DistributorClientDocumentCategory> = {
  pan: "pan",
  address_proof: "address_proof",
  aadhaar: "address_proof",
  bank_statement: "bank_proof",
  signature: "signature",
};

const STANDARD_DOCUMENT_SLOTS: Array<{
  stepId: string;
  id: string;
  label: string;
  category: DistributorClientDocumentCategory;
  identifierFromInvestor?: (investor: DistributorInvestor) => string | null;
  /** Shown for new-to-KYC investors when no file exists yet. */
  trackForNewKyc?: boolean;
}> = [
  {
    stepId: "pan",
    id: "doc-pan",
    label: "PAN card",
    category: "pan",
    identifierFromInvestor: (investor) => investor.panMasked,
  },
  {
    stepId: "address",
    id: "doc-address",
    label: "Address proof",
    category: "address_proof",
  },
  {
    stepId: "bank",
    id: "doc-bank",
    label: "Bank proof",
    category: "bank_proof",
  },
  {
    stepId: "signature",
    id: "doc-signature",
    label: "Signature",
    category: "signature",
    trackForNewKyc: true,
  },
];

function stepById(steps: DistributorClientKycStep[], id: string) {
  return steps.find((step) => step.id === id);
}

function mapApiKycDocument(
  document: ApiKycDocument,
  investor: DistributorInvestor,
): DistributorClientDocument | null {
  const category = DOC_TYPE_TO_CATEGORY[document.doc_type];
  if (!category) return null;

  const fileName = document.original_filename?.trim() || null;
  const uploaded = document.status === "active" && Boolean(fileName);
  const createdAt = document.created_at ?? null;

  return {
    id: String(document.id),
    category,
    label: DOC_TYPE_LABELS[document.doc_type] ?? document.doc_type,
    fileName,
    identifierMasked: category === "pan" ? investor.panMasked : null,
    uploadedAt: uploaded ? createdAt : null,
    status: uploaded ? "uploaded" : "missing",
    source: "Investor upload",
  };
}

function notRequiredDocument(
  investor: DistributorInvestor,
  slot: (typeof STANDARD_DOCUMENT_SLOTS)[number],
): DistributorClientDocument {
  return {
    id: slot.id,
    category: slot.category,
    label: slot.label,
    fileName: null,
    identifierMasked: slot.identifierFromInvestor?.(investor) ?? null,
    uploadedAt: null,
    status: "not_required",
    source: "KRA verified",
  };
}

function missingDocument(
  investor: DistributorInvestor,
  slot: (typeof STANDARD_DOCUMENT_SLOTS)[number],
): DistributorClientDocument {
  return {
    id: slot.id,
    category: slot.category,
    label: slot.label,
    fileName: null,
    identifierMasked: slot.identifierFromInvestor?.(investor) ?? null,
    uploadedAt: null,
    status: "missing",
    source: "Awaiting upload",
  };
}

export function buildClientDocumentsForInvestor(
  investor: DistributorInvestor,
  kycSteps: DistributorClientKycStep[],
  apiDocuments?: ApiKycDocument[] | null,
  kycCompliant = investor.complianceStatus === "Compliant",
): DistributorClientDocument[] {
  const apiByCategory = new Map<DistributorClientDocumentCategory, DistributorClientDocument>();
  const extraApiDocuments: DistributorClientDocument[] = [];

  for (const row of apiDocuments ?? []) {
    const mapped = mapApiKycDocument(row, investor);
    if (!mapped || mapped.status !== "uploaded") continue;

    if (STANDARD_DOCUMENT_SLOTS.some((slot) => slot.category === mapped.category)) {
      if (!apiByCategory.has(mapped.category)) {
        apiByCategory.set(mapped.category, mapped);
      }
      continue;
    }

    extraApiDocuments.push(mapped);
  }

  const slotDocuments = STANDARD_DOCUMENT_SLOTS.flatMap((slot) => {
    const fromApi = apiByCategory.get(slot.category);
    if (fromApi) return [fromApi];

    const step = stepById(kycSteps, slot.stepId);
    if (kycCompliant || step?.status === "not_applicable") {
      return [notRequiredDocument(investor, slot)];
    }

    if (slot.trackForNewKyc) {
      return [missingDocument(investor, slot)];
    }

    return [];
  });

  return [...slotDocuments, ...extraApiDocuments];
}

type DocumentCopy = (typeof import("@/lib/distributor-client-copy").DISTRIBUTOR_CLIENT_COPY)["documents"];

export function documentIdentifierLabel(
  doc: DistributorClientDocument,
  copy: DocumentCopy,
): string {
  if (doc.identifierMasked) return doc.identifierMasked;
  if (doc.status === "not_required") return copy.identifierNotSubmitted;
  if (doc.status === "missing") return copy.identifierNotSubmitted;
  return copy.identifierNone;
}

export function documentFileLabel(doc: DistributorClientDocument, copy: DocumentCopy): string {
  if (doc.fileName?.trim()) return doc.fileName.trim();
  if (doc.status === "not_required") return copy.fileNotSubmitted;
  if (doc.status === "missing") return copy.fileNotUploaded;
  return copy.fileNone;
}

export function documentUploadedLabel(
  doc: DistributorClientDocument,
  copy: DocumentCopy,
  formatDate: (value: string) => string,
): string {
  if (doc.uploadedAt) return formatDate(doc.uploadedAt);
  if (doc.status === "not_required") return copy.dateNotSubmitted;
  if (doc.status === "missing") return copy.dateNotUploaded;
  return copy.dateNone;
}
