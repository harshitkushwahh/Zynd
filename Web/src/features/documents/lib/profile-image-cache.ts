const CACHE_NAME = "zynd-profile-image-v1";
const META_PREFIX = "zynd:profile-image-meta:";

export type ProfileImageCacheMeta = {
  documentId: string;
  version: number;
  mimeType: string;
};

function metaKey(userId: string) {
  return `${META_PREFIX}${userId}`;
}

function blobKey(userId: string) {
  return `/__zynd_profile_image__/${encodeURIComponent(userId)}`;
}

function cacheStorage(): CacheStorage | null {
  if (typeof window === "undefined") return null;
  if (!("caches" in window)) return null;
  return window.caches;
}

export function readProfileImageMeta(userId: string): ProfileImageCacheMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(metaKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileImageCacheMeta>;
    if (!parsed.documentId || typeof parsed.version !== "number") return null;
    return {
      documentId: parsed.documentId,
      version: parsed.version,
      mimeType: parsed.mimeType ?? "image/jpeg",
    };
  } catch {
    return null;
  }
}

export async function readProfileImageBlob(userId: string): Promise<Blob | null> {
  const storage = cacheStorage();
  if (!storage) return null;
  try {
    const cache = await storage.open(CACHE_NAME);
    const match = await cache.match(blobKey(userId));
    if (!match) return null;
    return await match.blob();
  } catch {
    return null;
  }
}

export async function writeProfileImageCache(
  userId: string,
  meta: ProfileImageCacheMeta,
  blob: Blob,
): Promise<void> {
  const storage = cacheStorage();
  if (!storage) return;
  try {
    const cache = await storage.open(CACHE_NAME);
    await cache.put(
      blobKey(userId),
      new Response(blob, { headers: { "Content-Type": meta.mimeType || blob.type || "image/jpeg" } }),
    );
    window.localStorage.setItem(metaKey(userId), JSON.stringify(meta));
  } catch {
    // Storage unavailable (private mode, quota). The image still renders from memory.
  }
}

export async function clearProfileImageCache(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(metaKey(userId));
  } catch {
    // ignore
  }
  const storage = cacheStorage();
  if (!storage) return;
  try {
    const cache = await storage.open(CACHE_NAME);
    await cache.delete(blobKey(userId));
  } catch {
    // ignore
  }
}
