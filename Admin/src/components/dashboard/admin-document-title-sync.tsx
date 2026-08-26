"use client";

import { AdminDocumentTitlePathSync } from "@/hooks/use-admin-document-title";

/** Keeps the browser tab title in sync with the active admin dashboard route. */
export function AdminDocumentTitleSync() {
  return <AdminDocumentTitlePathSync />;
}
