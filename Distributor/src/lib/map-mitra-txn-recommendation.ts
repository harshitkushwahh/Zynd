import type {
  ApiMitraTxnRecommendation,
  MitraTxnRecommendationStatus,
} from "@/lib/distributor-txn-recommendations-api";
import { resolveDistributorAssetUrl } from "@/lib/distributor-asset-url";
import type {
  DistributorTransactionGroup,
  DistributorTxnRequest,
  TxnRequestStatus,
} from "@/lib/distributor-types";

function mapRecommendationStatus(status: MitraTxnRecommendationStatus): TxnRequestStatus {
  if (status === "invested") return "Approved";
  if (status === "expired" || status === "cancelled") return "Rejected";
  return "Pending";
}

function mapRecommendationGroupStatus(
  status: MitraTxnRecommendationStatus,
): DistributorTransactionGroup["status"] {
  if (status === "invested") return "Completed";
  if (status === "expired" || status === "cancelled") return "Draft";
  return "Submitted";
}

function recommendationFundCount(row: ApiMitraTxnRecommendation): number {
  return Math.max(row.item_count ?? 0, row.items?.length ?? 0, 1);
}

export function mapMitraTxnRecommendationToTxnRequest(
  row: ApiMitraTxnRecommendation,
  clientCode: string,
  investorEmailMasked: string,
): DistributorTxnRequest {
  const fundCount = recommendationFundCount(row);
  const isMultiFund = fundCount > 1;
  const primaryItem = row.items[0];
  return {
    id: row.id,
    requestRef: row.token.slice(0, 8).toUpperCase(),
    investorEmailMasked,
    clientCode,
    investorDisplayName: row.client_display_name?.trim() || clientCode,
    profileImageUrl: resolveDistributorAssetUrl(row.client_profile_image_url),
    requestType: row.investment_type === "sip" ? "SIP Register" : "Purchase",
    amount: row.amount_inr,
    status: mapRecommendationStatus(row.status),
    createdAt: row.created_at,
    inDistributorBook: true,
    fundCount: isMultiFund ? fundCount : undefined,
    fundSummary: isMultiFund ? row.fund_name : undefined,
    schemeName: isMultiFund ? row.fund_name : (primaryItem?.fund_name ?? row.fund_name),
    amcName: row.amc_name ?? primaryItem?.amc_name ?? null,
    amcSlug: row.amc_slug ?? primaryItem?.amc_slug ?? null,
    amcLogoUrl: row.amc_logo_url ?? primaryItem?.amc_logo_url ?? null,
  };
}

export function mapMitraTxnRecommendationToTransactionGroup(
  row: ApiMitraTxnRecommendation,
  clientCode: string,
): DistributorTransactionGroup {
  const fundCount = recommendationFundCount(row);
  const channel = row.investment_type === "sip" ? "sip" : "one-time";
  const channelLabel = channel === "sip" ? "SIP" : "One time";

  return {
    id: row.id,
    groupRef: row.token.slice(0, 8).toUpperCase(),
    label: `${channelLabel} · ${fundCount} funds · ${clientCode}`,
    investorCount: 1,
    legCount: fundCount,
    totalAmount: row.amount_inr,
    status: mapRecommendationGroupStatus(row.status),
    createdAt: row.created_at,
    channel,
    inDistributorBook: true,
  };
}

export function mapMitraTxnRecommendationsToOperations(items: ApiMitraTxnRecommendation[]): {
  requests: DistributorTxnRequest[];
  transactionGroups: DistributorTransactionGroup[];
} {
  const requests: DistributorTxnRequest[] = [];
  const transactionGroups: DistributorTransactionGroup[] = [];

  for (const row of items) {
    const clientCode = row.client_code ?? "—";
    const investorEmailMasked = row.client_email_masked ?? "—";
    const mappedRequest = mapMitraTxnRecommendationToTxnRequest(row, clientCode, investorEmailMasked);
    requests.push(mappedRequest);
    if (recommendationFundCount(row) > 1) {
      transactionGroups.push(mapMitraTxnRecommendationToTransactionGroup(row, clientCode));
    }
  }

  return { requests, transactionGroups };
}

export function txnRequestVariantId(request: DistributorTxnRequest): string {
  if (request.requestType === "SIP Register") return "sip";
  if (request.requestType === "Folio Update") return "group-transaction";
  if (request.requestType === "Purchase" || request.requestType === "Redeem") return "one-time";
  return "one-time";
}

export function transactionGroupVariantId(group: DistributorTransactionGroup): string {
  return group.channel ?? "one-time";
}
