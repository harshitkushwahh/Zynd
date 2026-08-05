from __future__ import annotations

import re
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class KycEligibilityResponse(BaseModel):
    eligible: bool
    reasons: list[str]


class KycPanVerifyRequest(BaseModel):
    pan_number: str = Field(min_length=10, max_length=10)


class KycPanFailure(BaseModel):
    field: str
    code: Optional[str] = None
    reason: Optional[str] = None


class KycPanConfirmNamesRequest(BaseModel):
    first_name: str = Field(min_length=2, max_length=80)
    middle_name: str = Field(default="", max_length=80)
    last_name: str = Field(min_length=2, max_length=80)


class KycPanConfirmNamesResponse(BaseModel):
    success: bool
    blocked: bool = False
    block_type: Optional[str] = None
    failure: Optional[KycPanFailure] = None
    pan_draft: Optional[dict[str, Any]] = None


class KycReadinessInfo(BaseModel):
    status: Optional[str] = None
    code: Optional[str] = None
    reason: Optional[str] = None


class KycPanVerifyResponse(BaseModel):
    success: bool
    blocked: bool = False
    block_type: Optional[str] = None
    message: Optional[str] = None
    failure: Optional[KycPanFailure] = None
    pan_draft: Optional[dict[str, Any]] = None
    kyc_already_registered: Optional[bool] = None
    readiness: Optional[KycReadinessInfo] = None
    requires_digilocker: Optional[bool] = None


class KycStepStatuses(BaseModel):
    pan: str
    digilocker: str
    address: str
    personal: str
    nominee: str
    bank: str
    signature: str
    review: str
    overall: str


class KycBootstrapResponse(BaseModel):
    eligible: bool
    reasons: list[str]
    last_completed_step: Optional[str] = None
    active_step_index: int = 0
    pan_draft: Optional[dict[str, Any]] = None
    contact_draft: Optional[dict[str, Any]] = None
    personal_draft: Optional[dict[str, Any]] = None
    nominee_draft: Optional[list[dict[str, Any]] | dict[str, Any]] = None
    bank_draft: Optional[dict[str, Any]] = None
    kyc_already_registered: Optional[bool] = None
    readiness_code: Optional[str] = None
    readiness_reason: Optional[str] = None
    pan_verification_status: Optional[str] = None
    pan_verification_failure: Optional[dict[str, Any]] = None
    external_identity_document_id: Optional[str] = None
    external_kyc_status: Optional[str] = None
    digilocker_failure_reason: Optional[str] = None
    bank_verification_status: Optional[str] = None
    bank_verification_failure: Optional[dict[str, Any]] = None
    poa_bank_preverify_id: Optional[str] = None
    poa_bank_proof_file_id: Optional[str] = None
    signature_draft: Optional[dict[str, Any]] = None
    external_kyc_form_id: Optional[str] = None
    kyc_form_status: Optional[str] = None
    kyc_form_type: Optional[str] = None
    kyc_form_failure_reason: Optional[str] = None
    proof_details_status: Optional[str] = None
    esign_details_status: Optional[str] = None
    step_statuses: Optional[KycStepStatuses] = None


class KycJourneyStateRequest(BaseModel):
    pan_draft_json: Optional[dict[str, Any]] = None
    contact_draft_json: Optional[dict[str, Any]] = None
    personal_draft_json: Optional[dict[str, Any]] = None
    nominee_draft_json: Optional[list[dict[str, Any]]] = None
    bank_draft_json: Optional[dict[str, Any]] = None
    signature_draft_json: Optional[dict[str, Any]] = None
    last_completed_step: Optional[
        Literal["pan", "digilocker", "address", "personal", "nominee", "bank", "signature", "review"]
    ] = None
    middle_name: Optional[str] = None


class KycJourneyStateResponse(BaseModel):
    success: bool = True
    last_completed_step: Optional[str] = None
    active_step_index: int = 0


class KycDigilockerStartResponse(BaseModel):
    redirect_url: str


class KycIdentityDocumentResponse(BaseModel):
    success: bool
    fetch_status: Optional[str] = None
    reason: Optional[str] = None
    aadhaar_not_selected: bool = False
    contact_draft: Optional[dict[str, Any]] = None
    personal_draft: Optional[dict[str, Any]] = None
    aadhaar_last4: Optional[str] = None


class KycMasterDataOption(BaseModel):
    label: str
    value: str


class KycMasterDataEnumsResponse(BaseModel):
    gender: list[KycMasterDataOption]
    marital_status: list[KycMasterDataOption]
    occupation: list[KycMasterDataOption]
    income_slab: list[KycMasterDataOption]
    pep_exposed: list[KycMasterDataOption]


class KycPincodeResponse(BaseModel):
    code: str
    city: str
    district: str
    state_name: str
    country_ansi_code: str


class KycStateItem(BaseModel):
    name: str
    state_code: str
    country_ansi_code: str


class KycCountryItem(BaseModel):
    name: str
    ansi_code: str


class KycNomineeEnumsResponse(BaseModel):
    relationships: list[KycMasterDataOption]
    source_of_wealth: list[KycMasterDataOption]
    document_types: list[KycMasterDataOption]


class KycBankVerifyRequest(BaseModel):
    account_number: str = Field(min_length=9, max_length=18)
    account_type: str
    ifsc_code: str = Field(min_length=11, max_length=11)

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc_code(cls, value: str) -> str:
        code = value.strip().upper()
        if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", code):
            raise ValueError("Enter a valid 11-character IFSC code.")
        return code


class KycBankFailure(BaseModel):
    field: str
    code: Optional[str] = None
    reason: Optional[str] = None


class KycBankVerifyResponse(BaseModel):
    success: bool
    account_holder_name: Optional[str] = None
    bank_name: Optional[str] = None
    branch: Optional[str] = None
    pan_verified: bool = False
    bank_verified: bool = False
    readiness_verified: bool = False
    requires_manual_verification: bool = False
    requires_proof_upload: bool = False
    preverify_id: Optional[str] = None
    failure: Optional[KycBankFailure] = None


class KycBankProofUploadResponse(BaseModel):
    file_id: str


class KycBankManualVerifyResponse(BaseModel):
    success: bool
    bank_verified: bool = False
    requires_manual_verification: bool = False
    requires_proof_upload: bool = False
    failure: Optional[KycBankFailure] = None


class KycBankPreverifyStatusResponse(BaseModel):
    status: Optional[str] = None
    bank_verified: bool = False
    code: Optional[str] = None
    reason: Optional[str] = None


class KycFormSubmitRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None


class KycFormSubmitResponse(BaseModel):
    form_id: Optional[str] = None
    form_status: Optional[str] = None
    next_action: str
    redirect_url: Optional[str] = None
    message: Optional[str] = None
    signature_provided: bool = False
    proof_status: Optional[str] = None
    esign_status: Optional[str] = None
    failure_reason: Optional[str] = None


class KycReadinessCheckResponse(BaseModel):
    kra_verified: bool
    overall_status: str
    readiness: KycReadinessInfo
    message: str
