export const DISTRIBUTOR_HTTP_ERROR_CODES = [
  400, 401, 403, 404, 408, 429, 500, 502, 503,
] as const;

export type DistributorHttpErrorCode = (typeof DISTRIBUTOR_HTTP_ERROR_CODES)[number];

export type DistributorHttpErrorContent = {
  title: string;
  description: string;
};

const HTTP_ERROR_CATALOG: Record<DistributorHttpErrorCode, DistributorHttpErrorContent> = {
  400: {
    title: "Bad request",
    description: "The request could not be understood. Check your input and try again.",
  },
  401: {
    title: "Sign in required",
    description: "Your session may have expired. Sign in again to continue in the Zynd Mitra console.",
  },
  403: {
    title: "Access denied",
    description: "You do not have permission to view this page or perform this action.",
  },
  404: {
    title: "Page not found",
    description: "This page does not exist or may have been moved. Check the URL or return to your workspace.",
  },
  408: {
    title: "Request timed out",
    description: "The server took too long to respond. Try again in a moment.",
  },
  429: {
    title: "Too many requests",
    description: "You have sent too many requests in a short time. Wait a moment and try again.",
  },
  500: {
    title: "Something went wrong",
    description: "An unexpected error occurred on our side. Try again or return to your dashboard.",
  },
  502: {
    title: "Service unavailable",
    description: "We could not reach the server. Try again shortly.",
  },
  503: {
    title: "Service temporarily unavailable",
    description: "Zynd Mitra is undergoing maintenance or is under heavy load. Please try again later.",
  },
};

export function isDistributorHttpErrorCode(value: number): value is DistributorHttpErrorCode {
  return (DISTRIBUTOR_HTTP_ERROR_CODES as readonly number[]).includes(value);
}

export function normalizeHttpErrorCode(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed) || parsed < 400 || parsed > 599) {
    return null;
  }
  return parsed;
}

export function getHttpErrorContent(code: number): DistributorHttpErrorContent {
  if (isDistributorHttpErrorCode(code)) {
    return HTTP_ERROR_CATALOG[code];
  }

  if (code >= 500) {
    return HTTP_ERROR_CATALOG[500];
  }

  if (code === 401) {
    return HTTP_ERROR_CATALOG[401];
  }

  if (code === 403) {
    return HTTP_ERROR_CATALOG[403];
  }

  if (code === 404) {
    return HTTP_ERROR_CATALOG[404];
  }

  return {
    title: "Request failed",
    description: "Something went wrong while loading this page.",
  };
}

/** @deprecated Use getHttpErrorContent from server components; icons resolve on the client. */
export function getHttpErrorDefinition(code: number): DistributorHttpErrorContent {
  return getHttpErrorContent(code);
}

export function distributorHttpErrorPath(code: number): string {
  return `/errors/${code}`;
}
