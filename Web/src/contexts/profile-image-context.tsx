"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/contexts/auth-context";
import { fetchProfileImageUrl } from "@/features/documents/api/documents-api";

type ProfileImageContextValue = {
  profileUrl: string | null;
  loading: boolean;
  refreshProfileImage: () => Promise<void>;
};

const ProfileImageContext = createContext<ProfileImageContextValue | null>(null);

export function ProfileImageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshProfileImage = useCallback(async () => {
    if (!user?.id) {
      setProfileUrl(null);
      return;
    }

    setLoading(true);
    try {
      const url = await fetchProfileImageUrl();
      setProfileUrl(url);
    } catch {
      setProfileUrl(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshProfileImage();
  }, [refreshProfileImage]);

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
