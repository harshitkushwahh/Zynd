import { QueryClient } from "@tanstack/react-query";

import { getBackendConnectionState, isBackendConnectionError } from "@/lib/api-client";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        refetchOnMount: true,
        refetchOnWindowFocus: () => !getBackendConnectionState().isWaiting,
        retry: (failureCount, error) =>
          !isBackendConnectionError(error) && failureCount < 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

export function clearQueryCache() {
  getQueryClient().clear();
}
