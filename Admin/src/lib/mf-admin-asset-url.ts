import { env } from "@/lib/env";

export function resolveAdminAssetUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("/")) return url;

  const marker = "/invest/assets/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex !== -1) {
    const assetPath = url.slice(markerIndex + marker.length);
    return `${env.apiUrl}${marker}${assetPath}`;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const documentsMarker = "/documents/public/";
  if (url.includes(documentsMarker)) {
    return url.startsWith(env.apiUrl) ? url : `${env.apiUrl.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
  }

  return url;
}
