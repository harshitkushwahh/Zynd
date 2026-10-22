from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, model_validator


class ZtoConsentTemplate(BaseModel):
    purpose: str
    text: str
    mode: str = "checkbox"


class ZtoConfigResponse(BaseModel):
    enabled: bool
    mode: Optional[str] = None
    partner_name: str
    bank_consent: ZtoConsentTemplate
    customer_consent: ZtoConsentTemplate


class ZtoFlowStatusResponse(BaseModel):
    enabled: bool
    phase: str
    review_required: bool
    bank_status: Optional[str] = None
    customer_status: Optional[str] = None


class ZtoFlowStartRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)


class ZtoOptInRequest(BaseModel):
    zto_bank_consent: bool = False
    zto_customer_consent: bool = False

    @model_validator(mode="after")
    def _both_consents_required(self) -> "ZtoOptInRequest":
        if self.zto_bank_consent != self.zto_customer_consent:
            raise ValueError("Accept both lookup consents.")
        if not self.zto_bank_consent:
            raise ValueError("Both lookup consents are required to opt in.")
        return self


class ZtoReviewFields(BaseModel):
    name: Optional[str] = None
    pan: Optional[str] = None
    date_of_birth: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    address_line: Optional[str] = None


class ZtoReviewDataResponse(BaseModel):
    phase: str
    review_required: bool
    fields: Optional[ZtoReviewFields] = None
    lookup_name: Optional[str] = None
    bank_available: bool = False
    customer_available: bool = False
    approved: Optional[ZtoReviewFields] = None


class ZtoReviewAcceptRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    pan: Optional[str] = Field(default=None, max_length=16)
    date_of_birth: Optional[str] = Field(default=None, max_length=16)
    bank_account_number: Optional[str] = Field(default=None, max_length=32)
    ifsc_code: Optional[str] = Field(default=None, max_length=16)
    address_line: Optional[str] = Field(default=None, max_length=1000)


class ZtoReviewAcceptResponse(BaseModel):
    phase: str
    approved: ZtoReviewFields
    edited: dict[str, bool]


class ZtoReviewDeclineResponse(BaseModel):
    phase: str


class ZtoBootstrapInfo(BaseModel):
    phase: str
    review_required: bool
