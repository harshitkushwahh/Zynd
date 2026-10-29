/** Keep in sync with Backend/app/application/support/customer_message_limits.py */

export const SUPPORT_MESSAGE_MIN_CHARS = 1;
export const SUPPORT_MESSAGE_MAX_CHARS = 4000;

export const SUPPORT_IMAGE_MIN_BYTES = 1;
export const SUPPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const SUPPORT_IMAGE_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp";

const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export type SupportImageValidationFailure =
  | "empty"
  | "too_large"
  | "invalid_type";

export function clampSupportMessageText(value: string): string {
  if (value.length <= SUPPORT_MESSAGE_MAX_CHARS) {
    return value;
  }
  return value.slice(0, SUPPORT_MESSAGE_MAX_CHARS);
}

export function validateSupportImageFile(
  file: File,
): { ok: true } | { ok: false; reason: SupportImageValidationFailure } {
  if (file.size < SUPPORT_IMAGE_MIN_BYTES) {
    return { ok: false, reason: "empty" };
  }
  if (file.size > SUPPORT_IMAGE_MAX_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  const mime = file.type.toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    return { ok: false, reason: "invalid_type" };
  }
  return { ok: true };
}

export function supportMessageCharCount(value: string): number {
  return value.length;
}
