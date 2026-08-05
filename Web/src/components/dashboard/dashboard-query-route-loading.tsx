/**
 * App Router fallback for dashboard segments backed by TanStack Query.
 *
 * Full route skeletons fight cached revisits (loading.tsx shows before the client
 * page mounts). Query hooks use `isPending && !data` for cold-load skeletons only.
 *
 * Keep heavy route loading.tsx on segments that are not query-backed (e.g. MF compare).
 */
export function DashboardQueryRouteLoading() {
  return (
    <div
      className="min-h-[12rem] w-full min-w-0"
      aria-busy="true"
      aria-label="Loading page"
    />
  );
}
