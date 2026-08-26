type QueryLoadSnapshot = {
  isPending: boolean;
  data: unknown;
  error: unknown;
};

export function portfolioQueryLoadState(query: QueryLoadSnapshot) {
  const hasResolved = !query.isPending || query.data !== undefined || query.error != null;
  const showSkeleton = query.isPending && query.data === undefined && query.error == null;

  return { hasResolved, showSkeleton };
}
