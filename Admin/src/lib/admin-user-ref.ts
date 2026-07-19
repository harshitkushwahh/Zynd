const ZYND_ID_SUFFIX = "@zynd";

export function clientIdToProfilePath(clientId: string) {
  const normalized = decodeURIComponent(clientId.trim());
  if (normalized.endsWith(ZYND_ID_SUFFIX)) {
    return normalized.slice(0, -ZYND_ID_SUFFIX.length);
  }
  return normalized;
}

export function profilePathToClientId(pathSegment: string) {
  const normalized = decodeURIComponent(pathSegment.trim());
  if (!normalized) return normalized;
  if (normalized.includes("@")) return normalized;
  return `${normalized}${ZYND_ID_SUFFIX}`;
}
