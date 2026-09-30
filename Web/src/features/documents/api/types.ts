export type DocumentType =
  | "aadhaar"
  | "pan"
  | "profile_image"
  | "bank_statement"
  | "signature"
  | "address_proof"
  | "nominee_id";

export type UserDocument = {
  id: string;
  client_id: string;
  doc_type: DocumentType;
  version: number;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  status: string;
  created_at: string;
};

export type DocumentListResponse = {
  documents: UserDocument[];
};

export type DocumentDownloadResponse = {
  download_url: string;
  expires_in: number;
  mime_type: string;
  filename: string;
  delivery?: "cdn" | "signed";
  cache_max_age?: number | null;
};
