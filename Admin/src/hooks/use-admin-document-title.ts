"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { applyAdminDocumentTitle } from "@/lib/admin-document-title";
import { useAdminAuth } from "@/contexts/admin-auth-context";

/** Updates the browser tab title when the dashboard route changes. */
export function AdminDocumentTitlePathSync() {
  const pathname = usePathname();
  const { roleKeys } = useAdminAuth();

  useLayoutEffect(() => {
    applyAdminDocumentTitle(pathname, roleKeys);
  }, [pathname, roleKeys]);

  return null;
}
