import type { ZtoReviewFields } from "@/features/kyc/lib/zto-types";
import { copy } from "@/shared/config/copy";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_PATTERN = /^[0-9]{6,24}$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export type ZtoReviewErrors = Partial<Record<keyof ZtoReviewFields, string>>;

function isValidIsoDate(value: string) {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getTime() <= Date.now()
  );
}

/** Blank values are allowed (lookup may not return every field); non-blank values must be well-formed. */
export function validateZtoReviewFields(values: ZtoReviewFields): ZtoReviewErrors {
  const errors: ZtoReviewErrors = {};
  const pan = (values.pan ?? "").trim().toUpperCase();
  const ifsc = (values.ifsc_code ?? "").trim().toUpperCase();
  const account = (values.bank_account_number ?? "").replace(/[\s-]/g, "");
  const dob = (values.date_of_birth ?? "").trim();

  if (pan && !PAN_PATTERN.test(pan)) errors.pan = copy.zto.review.invalidPan;
  if (ifsc && !IFSC_PATTERN.test(ifsc)) errors.ifsc_code = copy.zto.review.invalidIfsc;
  if (account && !ACCOUNT_PATTERN.test(account)) errors.bank_account_number = copy.zto.review.invalidBankAccount;
  if (dob && !isValidIsoDate(dob)) errors.date_of_birth = copy.zto.review.invalidDob;
  const pincode = (values.pincode ?? "").trim();
  if (pincode && !PINCODE_PATTERN.test(pincode)) errors.pincode = copy.kyc.address.invalidPincode;
  return errors;
}

export function normalizeZtoReviewFields(values: ZtoReviewFields): ZtoReviewFields {
  const clean = (value: string | null | undefined) => value?.trim() || null;
  return {
    name: clean(values.name),
    pan: clean(values.pan)?.toUpperCase() ?? null,
    date_of_birth: clean(values.date_of_birth),
    bank_account_number: clean(values.bank_account_number),
    ifsc_code: clean(values.ifsc_code)?.toUpperCase() ?? null,
    address_line_1: clean(values.address_line_1),
    address_line_2: clean(values.address_line_2),
    city: clean(values.city),
    state: clean(values.state),
    pincode: clean(values.pincode),
  };
}
