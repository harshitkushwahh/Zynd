"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/contexts/auth-context";
import { fetchLatestDocument, requestDocumentDownload } from "@/features/documents/api/documents-api";
import {
  clearProfileImageCache,
  readProfileImageBlob,
  readProfileImageMeta,
  writeProfileImageCache,
} from "@/features/documents/lib/profile-image-cache";

type ProfileImageContextValue = {
  profileUrl: string | null;
  loading: boolean;
  refreshProfileImage: () => Promise<void>;
};

const ProfileImageContext = createContext<ProfileImageContextValue | null>(null);

export function ProfileImageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const currentDocRef = useRef<{ documentId: string; version: number } | null>(null);
  const syncingRef = useRef<Promise<void> | null>(null);

  const applyBlob = useCallback((blob: Blob) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setProfileUrl(url);
  }, []);

  const clearImage = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    currentDocRef.current = null;
    setProfileUrl(null);
  }, []);

  const syncWithServer = useCallback(
    async (activeUserId: string) => {
      if (syncingRef.current) {
        return syncingRef.current;
      }
      const run = (async () => {
        try {
          const latest = await fetchLatestDocument("profile_image");
          if (!latest || latest.status !== "active") {
            clearImage();
            await clearProfileImageCache(activeUserId);
            return;
          }

          const current = currentDocRef.current;
          if (current && current.documentId === latest.id && current.version === latest.version) {
            return;
          }

          const download = await requestDocumentDownload(latest.id);
          let blob: Blob | null = null;
          try {
            const response = await fetch(download.download_url);
            if (response.ok) {
              blob = await response.blob();
            }
          } catch {
            blob = null;
          }

          currentDocRef.current = { documentId: latest.id, version: latest.version };
          if (blob) {
            applyBlob(blob);
            await writeProfileImageCache(
              activeUserId,
              { documentId: latest.id, version: latest.version, mimeType: latest.mime_type },
              blob,
            );
          } else {
            if (objectUrlRef.current) {
              URL.revokeObjectURL(objectUrlRef.current);
              objectUrlRef.current = null;
            }
            setProfileUrl(download.download_url);
          }
        } catch {
          if (!currentDocRef.current) {
            setProfileUrl(null);
          }
        } finally {
          setLoading(false);
        }
      })().finally(() => {
        syncingRef.current = null;
      });
      syncingRef.current = run;
      return run;
    },
    [applyBlob, clearImage],
  );

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!userId) {
        clearImage();
        setLoading(false);
        return;
      }

      const meta = readProfileImageMeta(userId);
      const blob = meta ? await readProfileImageBlob(userId) : null;
      if (cancelled) return;

      if (meta && blob) {
        // Serve the stored image instantly; the server check below only swaps it if the user uploaded a new one.
        currentDocRef.current = { documentId: meta.documentId, version: meta.version };
        applyBlob(blob);
        setLoading(false);
      } else {
        currentDocRef.current = null;
        setLoading(true);
      }
      void syncWithServer(userId);
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [applyBlob, clearImage, syncWithServer, userId]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const refreshProfileImage = useCallback(async () => {
    if (!userId) {
      clearImage();
      return;
    }
    currentDocRef.current = null;
    await syncWithServer(userId);
  }, [clearImage, syncWithServer, userId]);

  const value = useMemo(
    () => ({
      profileUrl,
      loading,
      refreshProfileImage,
    }),
    [profileUrl, loading, refreshProfileImage],
  );

  return <ProfileImageContext.Provider value={value}>{children}</ProfileImageContext.Provider>;
}

export function useProfileImage() {
  const context = useContext(ProfileImageContext);
  if (!context) {
    throw new Error("useProfileImage must be used within ProfileImageProvider");
  }
  return context;
}

export function useProfileImageOptional() {
  return useContext(ProfileImageContext);
}
