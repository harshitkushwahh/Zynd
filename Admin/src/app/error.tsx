"use client";

import { useEffect } from "react";

import { AdminErrorState } from "@/components/ui/admin-error-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin app error:", error);
  }, [error]);

  return (
    <AdminErrorState
      message={error.message || "An unexpected error occurred while rendering this page."}
      digest={error.digest}
      onAction={() => reset()}
    />
  );
}
