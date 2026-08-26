"use client";

import { useDocumentTitle } from "@/hooks/use-document-title";

/** Syncs the browser tab title with the current page. */
export function DocumentTitleSync() {
  useDocumentTitle();
  return null;
}
