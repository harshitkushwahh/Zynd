"""Stable consent definition keys — referenced by Web, Distributor, and Backend."""

from __future__ import annotations

PLATFORM_SIGNUP_LEGAL = "platform.signup_legal"
PLATFORM_TERMS_OF_SERVICE = "platform.terms_of_service"
PLATFORM_PRIVACY_POLICY = "platform.privacy_policy"
KYC_NOMINATION_OPT_OUT = "kyc.nomination_opt_out"
DISTRIBUTOR_CLIENT_NOMINATION_OPT_OUT = "distributor.client_nomination_opt_out"

ALL_SEED_KEYS = (
    PLATFORM_SIGNUP_LEGAL,
    PLATFORM_TERMS_OF_SERVICE,
    PLATFORM_PRIVACY_POLICY,
    KYC_NOMINATION_OPT_OUT,
    DISTRIBUTOR_CLIENT_NOMINATION_OPT_OUT,
)

__all__ = [
    "ALL_SEED_KEYS",
    "DISTRIBUTOR_CLIENT_NOMINATION_OPT_OUT",
    "KYC_NOMINATION_OPT_OUT",
    "PLATFORM_PRIVACY_POLICY",
    "PLATFORM_SIGNUP_LEGAL",
    "PLATFORM_TERMS_OF_SERVICE",
]
