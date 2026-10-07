import { env } from "@/lib/env";

/** Load a profile photo from the API host when the payload only has an API path. */
export function resolveProfileImageSrc(
  url: string | null | undefined,
  apiUrl: string = env.apiUrl,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  if (!trimmed.startsWith("/")) return trimmed;

  const base = apiUrl.trim().replace(/\/$/, "");
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return `${new URL(base).origin}${trimmed}`;
  }
  return trimmed;
}
