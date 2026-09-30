import { ApiError } from "@/lib/api-client";

import type { MitraTxnRecommendationStatus } from "@/features/recommendations/types/mitra-txn-recommendation";

export function formatMitraRecommendationPaymentMethod(method: string) {
  if (method === "upi") return "UPI";
  if (method === "netbanking") return "Net banking";
  return method;
}

export function formatMitraRecommendationInvestmentType(type: string) {
  return type === "sip" ? "SIP" : "One-time";
}

export function formatMitraRecommendationExpiryLabel(expiresAt: string) {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function resolveMitraRecommendationLoadError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return {
      title: "Could not load recommendation",
      description: "Something went wrong while loading this recommendation.",
    };
  }

  if (error.status === 404) {
    return {
      title: "Recommendation not found",
      description: "This link may be invalid or has already been removed.",
    };
  }

  if (error.status === 403) {
    return {
      title: "This recommendation is not for your account",
      description: "Sign in with the investor account your Mitra used when sending this link.",
    };
  }

  if (error.status === 410 || error.code === "expired" || error.code === "cancelled") {
    return {
      title: "This recommendation is no longer active",
      description: error.message || "The link may have expired or been cancelled.",
    };
  }

  return {
    title: "Could not load recommendation",
    description: error.message,
  };
}

export function resolveMitraRecommendationInactiveMessage(status: MitraTxnRecommendationStatus) {
  if (status === "expired") {
    return {
      title: "This recommendation is no longer active",
      description: "This recommendation link has expired.",
    };
  }
  if (status === "cancelled") {
    return {
      title: "This recommendation is no longer active",
      description: "This recommendation was cancelled.",
    };
  }
  if (status === "invested") {
    return {
      title: "Already invested",
      description: "This recommendation has already been applied to your cart and invested.",
    };
  }
  return {
    title: "This recommendation is no longer active",
    description: "Ask your Mitra for a fresh link if you still want to invest.",
  };
}
