import type { DistributorClientKycStep } from "@/lib/distributor-types";
import type { DistributorInvestor } from "@/lib/distributor-types";
import type {
  SupportClientKycPartnerSnapshot,
  SupportKycPartnerResponseVariant,
  SupportKycPartnerVerificationStatus,
  SupportKycVerificationStatusCard,
} from "@/lib/support-client-kyc-partner-model";

function stepStatus(
  steps: DistributorClientKycStep[],
  stepId: string,
): SupportKycPartnerVerificationStatus {
  const step = steps.find((row) => row.id === stepId);
  if (!step || step.applicable === false) return "skipped";
  switch (step.status) {
    case "completed":
      return "verified";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
    case "not_applicable":
      return "skipped";
    default:
      return "not_started";
  }
}

function statusLabel(status: SupportKycPartnerVerificationStatus): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    case "skipped":
      return "Not required";
    case "not_started":
      return "Not started";
    default:
      return "Unknown";
  }
}

function isoOffsetMinutes(base: string, minutes: number): string {
  const date = new Date(base);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function variantLabel(index: number): string {
  return `Variant ${index + 1}`;
}

function buildVerificationCards(
  steps: DistributorClientKycStep[],
  initiatedAt: string,
  clientCode: string,
): SupportKycVerificationStatusCard[] {
  const defs: Array<{
    id: SupportKycVerificationStatusCard["id"];
    label: string;
    stepId: string;
    hintVerified: string;
    hintPending: string;
  }> = [
    {
      id: "pan",
      label: "PAN verification",
      stepId: "pan",
      hintVerified: "Name and DOB matched with ITD records",
      hintPending: "Awaiting partner confirmation",
    },
    {
      id: "digilocker",
      label: "DigiLocker",
      stepId: "digilocker",
      hintVerified: "Aadhaar address prefilled from DigiLocker",
      hintPending: "Investor has not finished DigiLocker consent",
    },
    {
      id: "bank",
      label: "Bank verification",
      stepId: "bank",
      hintVerified: "Penny drop succeeded and account name matched",
      hintPending: "Bank account validation in progress",
    },
    {
      id: "esign",
      label: "eSign",
      stepId: "esign",
      hintVerified: "Aadhaar OTP signature captured on KYC form",
      hintPending: "Waiting for eSign completion at review",
    },
  ];

  return defs.map((def, index) => {
    const status = stepStatus(steps, def.stepId);
    const verified = status === "verified";
    return {
      id: def.id,
      label: def.label,
      status,
      statusLabel: statusLabel(status),
      hint: verified ? def.hintVerified : def.hintPending,
      partnerRef:
        status === "not_started" || status === "skipped"
          ? null
          : `fp_${clientCode.toLowerCase()}_${def.id}_${index + 1}`,
      updatedAt:
        status === "not_started" || status === "skipped" ? null : isoOffsetMinutes(initiatedAt, 12 + index * 47),
    };
  });
}

function buildPanVariants(
  clientCode: string,
  panStatus: SupportKycPartnerVerificationStatus,
  initiatedAt: string,
): SupportKycPartnerResponseVariant[] {
  const baseRecorded = isoOffsetMinutes(initiatedAt, 8);
  return [
    {
      id: "pan-v1",
      label: variantLabel(0),
      partner: "FinPrim PAN",
      externalId: `pan_verify_${clientCode}`,
      httpStatus: 200,
      recordedAt: baseRecorded,
      status: "verified",
      statusLabel: statusLabel("verified"),
      payload: {
        request_id: `pan_verify_${clientCode}`,
        pan: "ABCDE1234F",
        name_match: "Y",
        dob_match: "Y",
        status: "valid",
        source: "finprim_pan_v2",
      },
    },
    {
      id: "pan-v2",
      label: variantLabel(1),
      partner: "FinPrim PAN",
      externalId: `pan_verify_${clientCode}_async`,
      httpStatus: 202,
      recordedAt: isoOffsetMinutes(initiatedAt, 6),
      status: "pending",
      statusLabel: statusLabel("pending"),
      payload: {
        request_id: `pan_verify_${clientCode}_async`,
        pan: "ABCDE1234F",
        status: "processing",
        poll_after_seconds: 3,
        source: "finprim_pan_v2",
      },
    },
    {
      id: "pan-v3",
      label: variantLabel(2),
      partner: "FinPrim PAN",
      externalId: `pan_verify_${clientCode}_mismatch`,
      httpStatus: 422,
      recordedAt: isoOffsetMinutes(initiatedAt, 9),
      status: "failed",
      statusLabel: statusLabel("failed"),
      payload: {
        request_id: `pan_verify_${clientCode}_mismatch`,
        pan: "ABCDE1234F",
        name_match: "N",
        dob_match: "Y",
        status: "invalid",
        reason: "name_mismatch",
        source: "finprim_pan_v2",
      },
    },
    {
      id: "pan-v4",
      label: variantLabel(3),
      partner: "FinPrim PAN",
      externalId: `pan_verify_${clientCode}_legacy`,
      httpStatus: panStatus === "failed" ? 422 : 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 11),
      status: panStatus === "not_started" ? "not_started" : panStatus,
      statusLabel: statusLabel(panStatus === "not_started" ? "not_started" : panStatus),
      payload: {
        id: `pan_verify_${clientCode}_legacy`,
        pan_number: "ABCDE1234F",
        verification_result: panStatus === "verified" ? "SUCCESS" : "PENDING",
        itd_name: panStatus === "verified" ? "Investor Name" : null,
        api_version: "v1",
      },
    },
  ];
}

function buildDigilockerVariants(
  clientCode: string,
  digilockerStatus: SupportKycPartnerVerificationStatus,
  initiatedAt: string,
): SupportKycPartnerResponseVariant[] {
  return [
    {
      id: "idl-v1",
      label: variantLabel(0),
      partner: "FinPrim Identity document",
      externalId: `idl_${clientCode}`,
      httpStatus: 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 36),
      status: "verified",
      statusLabel: statusLabel("verified"),
      payload: {
        identity_document_id: `idl_${clientCode}`,
        document_type: "aadhaar",
        consent_status: "completed",
        address_line1: "12, Lake View Apartments",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        callback: "POST /api/v1/kyc/public/digilocker-callback",
      },
    },
    {
      id: "idl-v2",
      label: variantLabel(1),
      partner: "FinPrim Identity document",
      externalId: `idl_${clientCode}_awaiting`,
      httpStatus: 202,
      recordedAt: isoOffsetMinutes(initiatedAt, 34),
      status: "pending",
      statusLabel: statusLabel("pending"),
      payload: {
        identity_document_id: `idl_${clientCode}_awaiting`,
        document_type: "aadhaar",
        consent_status: "awaiting_user",
        redirect_url: "https://s.finprim.com/digilocker/session/example",
      },
    },
    {
      id: "idl-v3",
      label: variantLabel(2),
      partner: "FinPrim Identity document",
      externalId: `idl_${clientCode}_expired`,
      httpStatus: 410,
      recordedAt: isoOffsetMinutes(initiatedAt, 40),
      status: "failed",
      statusLabel: statusLabel("failed"),
      payload: {
        identity_document_id: `idl_${clientCode}_expired`,
        consent_status: "expired",
        error_code: "digilocker_session_expired",
      },
    },
    {
      id: "idl-v4",
      label: variantLabel(3),
      partner: "FinPrim Identity document",
      externalId: digilockerStatus === "not_started" ? null : `idl_${clientCode}_partial`,
      httpStatus: digilockerStatus === "not_started" ? null : 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 38),
      status: digilockerStatus === "not_started" ? "not_started" : digilockerStatus,
      statusLabel: statusLabel(digilockerStatus === "not_started" ? "not_started" : digilockerStatus),
      payload: {
        identity_document_id: digilockerStatus === "not_started" ? null : `idl_${clientCode}_partial`,
        document_type: "aadhaar",
        consent_status:
          digilockerStatus === "verified"
            ? "completed"
            : digilockerStatus === "pending"
              ? "awaiting_user"
              : "not_initiated",
        fathers_name: digilockerStatus === "verified" ? "R Kumar" : null,
      },
    },
  ];
}

function buildBankVariants(
  clientCode: string,
  investorName: string,
  bankStatus: SupportKycPartnerVerificationStatus,
  initiatedAt: string,
  ifscCode: string,
): SupportKycPartnerResponseVariant[] {
  return [
    {
      id: "bav-v1",
      label: variantLabel(0),
      partner: "FinPrim Bank account",
      externalId: `bav_${clientCode}`,
      httpStatus: 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 128),
      status: "verified",
      statusLabel: statusLabel("verified"),
      payload: {
        verification_id: `bav_${clientCode}`,
        ifsc: ifscCode,
        account_number_last4: "7890",
        account_holder_name: investorName,
        name_match_score: 0.98,
        penny_drop_status: "success",
      },
    },
    {
      id: "bav-v2",
      label: variantLabel(1),
      partner: "FinPrim Bank account",
      externalId: `bav_${clientCode}_pending`,
      httpStatus: 202,
      recordedAt: isoOffsetMinutes(initiatedAt, 126),
      status: "pending",
      statusLabel: statusLabel("pending"),
      payload: {
        verification_id: `bav_${clientCode}_pending`,
        ifsc: ifscCode,
        account_number_last4: "7890",
        penny_drop_status: "initiated",
      },
    },
    {
      id: "bav-v3",
      label: variantLabel(2),
      partner: "FinPrim Bank account",
      externalId: `bav_${clientCode}_failed`,
      httpStatus: 422,
      recordedAt: isoOffsetMinutes(initiatedAt, 130),
      status: "failed",
      statusLabel: statusLabel("failed"),
      payload: {
        verification_id: `bav_${clientCode}_failed`,
        ifsc: ifscCode,
        account_number_last4: "7890",
        name_match_score: 0.41,
        penny_drop_status: "failed",
        failure_reason: "Account holder name mismatch",
      },
    },
    {
      id: "bav-v4",
      label: variantLabel(3),
      partner: "FinPrim Bank account",
      externalId: bankStatus === "not_started" ? null : `bav_${clientCode}_manual`,
      httpStatus: bankStatus === "not_started" ? null : 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 132),
      status: bankStatus === "not_started" ? "not_started" : bankStatus,
      statusLabel: statusLabel(bankStatus === "not_started" ? "not_started" : bankStatus),
      payload: {
        verification_id: bankStatus === "not_started" ? null : `bav_${clientCode}_manual`,
        ifsc: ifscCode,
        account_number_last4: "7890",
        verification_mode: "manual_review",
        review_status: bankStatus === "verified" ? "approved" : "pending",
      },
    },
  ];
}

function buildIfscVariants(
  ifscCode: string,
  bankStatus: SupportKycPartnerVerificationStatus,
  initiatedAt: string,
): SupportKycPartnerResponseVariant[] {
  const summary = {
    ifscCode,
    bankName: "HDFC Bank",
    branchLabel: "Koramangala, Bengaluru Urban, Karnataka",
    city: "Bengaluru",
    state: "Karnataka",
  };

  return [
    {
      id: "ifsc-v1",
      label: variantLabel(0),
      partner: "FinPrim IFSC lookup",
      externalId: `ifsc_${ifscCode}`,
      httpStatus: 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 118),
      status: "verified",
      statusLabel: "Resolved",
      summary,
      payload: {
        ifsc_code: ifscCode,
        bank_name: "HDFC",
        branch_name: "Koramangala",
        city: "Bengaluru",
        district: "Bengaluru Urban",
        state: "Karnataka",
        normalized_bank_name: "HDFC Bank",
        normalized_branch: "Koramangala, Bengaluru Urban, Karnataka",
      },
    },
    {
      id: "ifsc-v2",
      label: variantLabel(1),
      partner: "FinPrim IFSC lookup",
      externalId: `ifsc_${ifscCode}_icici`,
      httpStatus: 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 119),
      status: "verified",
      statusLabel: "Resolved",
      summary: {
        ifscCode: "ICIC0000611",
        bankName: "ICICI Bank",
        branchLabel: "gudivada, KRISHNA, ANDHRA PRADESH",
        city: "gudivada",
        state: "ANDHRA PRADESH",
      },
      payload: {
        ifsc_code: "ICIC0000611",
        bank_name: "ICICI",
        branch_name: "gudivada",
        city: "gudivada",
        district: "KRISHNA",
        state: "ANDHRA PRADESH",
        normalized_bank_name: "ICICI Bank",
        normalized_branch: "gudivada, KRISHNA, ANDHRA PRADESH",
      },
    },
    {
      id: "ifsc-v3",
      label: variantLabel(2),
      partner: "FinPrim IFSC lookup",
      externalId: `ifsc_INVALID`,
      httpStatus: 404,
      recordedAt: isoOffsetMinutes(initiatedAt, 120),
      status: "failed",
      statusLabel: statusLabel("failed"),
      summary: null,
      payload: {
        ifsc_code: "INVALID0000",
        error: "ifsc_not_found",
        message: "IFSC code could not be resolved",
      },
    },
    {
      id: "ifsc-v4",
      label: variantLabel(3),
      partner: "FinPrim IFSC lookup",
      externalId: bankStatus === "not_started" ? null : `ifsc_${ifscCode}_fallback`,
      httpStatus: bankStatus === "not_started" ? null : 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 121),
      status: bankStatus === "not_started" ? "not_started" : "verified",
      statusLabel: bankStatus === "not_started" ? statusLabel("not_started") : "Resolved",
      summary: bankStatus === "not_started" ? null : summary,
      payload: {
        ifsc_code: ifscCode,
        bank_name: "HDFC",
        branch_name: "Koramangala",
        source: "fallback_cache",
        cached_at: isoOffsetMinutes(initiatedAt, 100),
      },
    },
  ];
}

function buildEsignVariants(
  clientCode: string,
  esignStatus: SupportKycPartnerVerificationStatus,
  initiatedAt: string,
): SupportKycPartnerResponseVariant[] {
  return [
    {
      id: "esign-v1",
      label: variantLabel(0),
      partner: "Cybrilla KYC form eSign",
      externalId: `esign_${clientCode}`,
      httpStatus: 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 210),
      status: "verified",
      statusLabel: statusLabel("verified"),
      payload: {
        kyc_form_id: `kycf_live_${clientCode.slice(-3)}`,
        esign_status: "signed",
        signer_aadhaar_last4: "4321",
        signed_at: isoOffsetMinutes(initiatedAt, 215),
        document_type: "kyc_form",
      },
    },
    {
      id: "esign-v2",
      label: variantLabel(1),
      partner: "Cybrilla KYC form eSign",
      externalId: `esign_${clientCode}_awaiting`,
      httpStatus: 202,
      recordedAt: isoOffsetMinutes(initiatedAt, 208),
      status: "pending",
      statusLabel: statusLabel("pending"),
      payload: {
        kyc_form_id: `kycf_live_${clientCode.slice(-3)}`,
        esign_status: "awaiting_esign",
        redirect_url: "https://cybrilla.example/esign/session",
      },
    },
    {
      id: "esign-v3",
      label: variantLabel(2),
      partner: "Cybrilla KYC form eSign",
      externalId: `esign_${clientCode}_declined`,
      httpStatus: 422,
      recordedAt: isoOffsetMinutes(initiatedAt, 212),
      status: "failed",
      statusLabel: statusLabel("failed"),
      payload: {
        kyc_form_id: `kycf_live_${clientCode.slice(-3)}`,
        esign_status: "declined",
        failure_reason: "otp_attempts_exceeded",
      },
    },
    {
      id: "esign-v4",
      label: variantLabel(3),
      partner: "Cybrilla KYC form eSign",
      externalId: esignStatus === "not_started" ? null : `esign_${clientCode}_webhook`,
      httpStatus: esignStatus === "not_started" ? null : 200,
      recordedAt: isoOffsetMinutes(initiatedAt, 216),
      status: esignStatus === "not_started" ? "not_started" : esignStatus,
      statusLabel: statusLabel(esignStatus === "not_started" ? "not_started" : esignStatus),
      payload: {
        kyc_form_id: esignStatus === "not_started" ? null : `kycf_live_${clientCode.slice(-3)}`,
        esign_status:
          esignStatus === "verified"
            ? "signed"
            : esignStatus === "pending"
              ? "awaiting_esign"
              : "not_started",
        webhook_event: "kyc_form.esign.updated",
      },
    },
  ];
}

export function buildSupportClientKycPartnerSnapshot(args: {
  investor: DistributorInvestor;
  steps: DistributorClientKycStep[];
  kycInitiatedAt: string;
}): SupportClientKycPartnerSnapshot {
  const { investor, steps, kycInitiatedAt } = args;
  const clientCode = investor.clientCode;
  const panStatus = stepStatus(steps, "pan");
  const digilockerStatus = stepStatus(steps, "digilocker");
  const bankStatus = stepStatus(steps, "bank");
  const esignStatus = stepStatus(steps, "esign");

  const ifscCode = "HDFC0001234";
  const verificationCards = buildVerificationCards(steps, kycInitiatedAt, clientCode);

  const panVariants = buildPanVariants(clientCode, panStatus, kycInitiatedAt);
  const orderedPanVariants = [
    panVariants.find((row) => row.status === panStatus) ?? panVariants[0],
    ...panVariants.filter((row) => row.status !== panStatus),
  ].filter(Boolean) as SupportKycPartnerResponseVariant[];

  return {
    verificationCards,
    responses: {
      verification: { variants: orderedPanVariants.length ? orderedPanVariants : panVariants },
      digilocker: { variants: buildDigilockerVariants(clientCode, digilockerStatus, kycInitiatedAt) },
      bank: {
        variants: buildBankVariants(clientCode, investor.displayName, bankStatus, kycInitiatedAt, ifscCode),
      },
      ifsc: { variants: buildIfscVariants(ifscCode, bankStatus, kycInitiatedAt) },
      esign: { variants: buildEsignVariants(clientCode, esignStatus, kycInitiatedAt) },
    },
  };
}
