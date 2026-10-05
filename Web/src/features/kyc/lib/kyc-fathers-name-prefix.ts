/** DigiLocker / Aadhaar care-of relation prefixes (order matters; strip until stable). */
export const FATHERS_NAME_DIGILOCKER_PREFIX_RES: RegExp[] = [
  /^(?:son|daughter|wife|husband|care|father|mother|so|do|wo|co|ho|fo)\s+of\s*:?\s*/i,
  /^(?:s|d|w|c|h|f)(?:\s*[/\-]\s*|\s+)o\.?\s*:?\s*/i,
  /^(?:s|d|w|c|h|f)\.\s*o\.?\s*:?\s*/i,
  /^(?:so|do|wo|co|ho|fo)\.?\s*:?\s*/i,
];

export function stripFathersNameDigilockerPrefixes(value: string): string {
  let result = value.trim();
  while (result) {
    let changed = false;
    for (const pattern of FATHERS_NAME_DIGILOCKER_PREFIX_RES) {
      const stripped = result.replace(pattern, "").trim();
      if (stripped !== result) {
        result = stripped;
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return result;
}
