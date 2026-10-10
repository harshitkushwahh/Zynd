export function kycPayloadObjectLabel(payload: Record<string, unknown>): string | null {
  const object = payload.object;
  if (typeof object === "string" && object.trim()) return object;
  const status = payload.status;
  if (typeof status === "string" && status.trim()) return status;
  const id = payload.id;
  if (typeof id === "string" && id.trim()) return id;
  return null;
}

export function kycPayloadPreviewDetail(payload: Record<string, unknown>, maxLength = 88): string {
  const raw = JSON.stringify(payload);
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}…`;
}
