import { getAdminPageTitle } from "@/lib/admin-navigation";

export const ADMIN_DOCUMENT_TITLE_SUFFIX = "ZYND Admin";

export function formatAdminDocumentTitle(pageLabel: string): string {
  return `${pageLabel} · ${ADMIN_DOCUMENT_TITLE_SUFFIX}`;
}

export function resolveAdminDocumentTitle(pathname: string, roleKeys: string[] = []): string {
  return getAdminPageTitle(pathname, roleKeys);
}

export function applyAdminDocumentTitle(pathname: string, roleKeys: string[] = []): void {
  if (typeof document === "undefined") return;
  const pageLabel = resolveAdminDocumentTitle(pathname, roleKeys);
  const nextTitle = formatAdminDocumentTitle(pageLabel);
  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
}
