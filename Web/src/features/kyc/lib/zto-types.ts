export type ZtoPhase =
  | "DISABLED"
  | "NOT_STARTED"
  | "LOOKUP_PENDING"
  | "LOOKUPS_RUNNING"
  | "REVIEW_PENDING"
  | "LOOKUPS_FAILED"
  | "ACCEPTED"
  | "DECLINED";

export type ZtoConsentTemplate = {
  purpose: string;
  text: string;
  mode: string;
};

export type ZtoConfig = {
  enabled: boolean;
  mode: string | null;
  partner_name: string;
  bank_consent: ZtoConsentTemplate;
  customer_consent: ZtoConsentTemplate;
};

export type ZtoFlowStatus = {
  enabled: boolean;
  phase: ZtoPhase;
  review_required: boolean;
  bank_status: string | null;
  customer_status: string | null;
};

export type ZtoReviewFields = {
  name: string | null;
  pan: string | null;
  date_of_birth: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  /** Combined display line when returned from the API; not submitted on accept. */
  address_line?: string | null;
};

export type ZtoReviewData = {
  phase: ZtoPhase;
  review_required: boolean;
  fields: ZtoReviewFields | null;
  lookup_name: string | null;
  bank_available: boolean;
  customer_available: boolean;
  approved: ZtoReviewFields | null;
};

export type ZtoAcceptResponse = {
  phase: ZtoPhase;
  approved: ZtoReviewFields;
  edited: Record<keyof ZtoReviewFields, boolean>;
};

export type ZtoBootstrapInfo = {
  phase: ZtoPhase;
  review_required: boolean;
};
