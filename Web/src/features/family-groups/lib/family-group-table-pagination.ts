export const FAMILY_GROUP_TABLE_PAGE_SIZE = 10;

export function paginateItems<T>(items: T[], page: number, pageSize = FAMILY_GROUP_TABLE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const boundedPage = Math.min(Math.max(1, page), totalPages);
  const start = (boundedPage - 1) * pageSize;

  return {
    page: boundedPage,
    totalPages,
    pageItems: items.slice(start, start + pageSize),
    showPagination: items.length > pageSize,
  };
}
