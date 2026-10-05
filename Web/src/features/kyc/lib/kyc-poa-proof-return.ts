import { fetchPoaKycFormStatus } from "@/features/kyc/lib/kyc-api";

const POA_PROOF_RETURN_HANDLED = "kyc_poa_proof_return_handled";

function isHandled(signature: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(POA_PROOF_RETURN_HANDLED) === signature;
  } catch {
    return false;
  }
}

function markHandled(signature: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(POA_PROOF_RETURN_HANDLED, signature);
  } catch {
    // ignore
  }
}

export async function processPoaProofReturnFromUrl(
  search = typeof window === "undefined" ? "" : window.location.search,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(search);
  const isReturn =
    params.get("poa_proof_return") === "1" || params.get("kyc_proof_return") === "1";
  if (!isReturn) return false;

  const formId = params.get("kyc_form") ?? params.get("kyc_form_id") ?? "";
  const status = params.get("status") ?? "failed";
  const signature = `${formId}:${status}`;
  if (isHandled(signature)) {
    stripParams(params);
    return false;
  }
  markHandled(signature);
  stripParams(params);

  if (status !== "successful") {
    return false;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const poaStatus = await fetchPoaKycFormStatus();
    if (!poaStatus.needs_digilocker) {
      return true;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 800));
  }
  return true;
}

function stripParams(params: URLSearchParams): void {
  params.delete("poa_proof_return");
  params.delete("kyc_proof_return");
  params.delete("kyc_form");
  params.delete("kyc_form_id");
  params.delete("status");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}
