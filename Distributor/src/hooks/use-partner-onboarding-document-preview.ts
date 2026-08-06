"use client";

import { useEffect, useRef, useState } from "react";

import { fetchPartnerOnboardingDocumentPreviewUrl } from "@/lib/distributor-partners-api";

type UsePartnerOnboardingDocumentPreviewOptions = {
  onboardingToken: string | null;
  docType: "pan" | "aadhaar";
  fileName: string | null;
  previewUrl: string | null;
};

export function usePartnerOnboardingDocumentPreview({
  onboardingToken,
  docType,
  fileName,
  previewUrl,
}: UsePartnerOnboardingDocumentPreviewOptions) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(previewUrl);
  const [loading, setLoading] = useState(false);
  const fetchedBlobRef = useRef<string | null>(null);

  useEffect(() => {
    if (previewUrl) {
      setResolvedUrl(previewUrl);
      setLoading(false);
      return;
    }

    if (!onboardingToken || !fileName) {
      setResolvedUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchPartnerOnboardingDocumentPreviewUrl(onboardingToken, docType)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        if (fetchedBlobRef.current?.startsWith("blob:")) {
          URL.revokeObjectURL(fetchedBlobRef.current);
        }
        fetchedBlobRef.current = url;
        setResolvedUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [docType, fileName, onboardingToken, previewUrl]);

  useEffect(() => {
    return () => {
      if (fetchedBlobRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(fetchedBlobRef.current);
      }
    };
  }, []);

  return { previewUrl: resolvedUrl, loading };
}
