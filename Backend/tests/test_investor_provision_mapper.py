from __future__ import annotations

import pytest

from app.application.investor.investor_bank_account_crypto import encrypt_account_number
from app.application.investor.investor_provision_mapper import (
    build_bank_account_payload,
    build_investor_profile_payload,
    build_phone_payload,
    build_related_party_payload,
)
from app.infrastructure.persistence.investor_models import (
    InvestorBankAccount,
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorPhoneNumber,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.models import KycJourneyState, User


def _sample_user() -> User:
    from uuid import uuid4

    return User(
        id=uuid4(),
        email="investor@example.com",
        phone="+919876543210",
        password_hash="hash",
    )


def _sample_journey(user_id) -> KycJourneyState:
    return KycJourneyState(
        user_id=user_id,
        pan_draft_json={
            "panNumber": "ABCDE1234F",
            "dateOfBirth": "1990-05-01",
            "firstName": "Asha",
            "lastName": "Patel",
        },
        personal_draft_json={
            "gender": "female",
            "occupation": "private_sector",
            "incomeSlab": "above_1lakh_upto_5lakh",
            "pepExposed": "not_applicable",
            "placeOfBirth": "Mumbai",
        },
        contact_draft_json={
            "permanent": {
                "line1": "12 MG Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001",
                "country": "India",
            },
            "sameAsPermanent": True,
        },
        bank_draft_json={
            "accountNumber": "123456789012",
            "ifscCode": "HDFC0001234",
            "accountType": "Savings",
            "accountHolderName": "Asha Patel",
            "panAccountHolderName": "Asha Patel",
        },
    )


def test_build_investor_profile_payload() -> None:
    user = _sample_user()
    journey = _sample_journey(user.id)
    payload = build_investor_profile_payload(user=user, journey=journey)

    assert payload["type"] == "individual"
    assert payload["tax_status"] == "resident_individual"
    assert payload["name"] == "Asha Patel"
    assert payload["pan"] == "ABCDE1234F"
    assert payload["source_of_wealth"] == "salary"
    assert payload["use_default_tax_residences"] is True


def test_build_bank_account_payload_maps_nre_type() -> None:
    user = _sample_user()
    journey = _sample_journey(user.id)
    bank_row = InvestorBankAccount(
        investor_profile_id=user.id,
        account_type="nre_savings",
        account_number_last4="9012",
        ifsc_code="HDFC0001234",
        primary_account_holder_name="Asha Patel",
        source=InvestorObjectSource.kyc,
        sync_status=InvestorObjectSyncStatus.draft,
    )
    payload = build_bank_account_payload(profile_id="invp_test", bank_row=bank_row, journey=journey)

    assert payload["profile"] == "invp_test"
    assert payload["account_number"] == "123456789012"
    assert payload["type"] == "nre"


def test_build_bank_account_payload_prefers_encrypted_row_account_number() -> None:
    user = _sample_user()
    journey = _sample_journey(user.id)
    journey.bank_draft_json = {"accountNumber": "000000000000"}
    ciphertext, key_version = encrypt_account_number("123456789012")
    bank_row = InvestorBankAccount(
        investor_profile_id=user.id,
        account_type="savings",
        account_number_last4="9012",
        ifsc_code="HDFC0001234",
        primary_account_holder_name="Asha Patel",
        pan_account_holder_name="Asha Patel",
        account_number_ciphertext=ciphertext,
        account_number_key_version=key_version,
        source=InvestorObjectSource.kyc,
        sync_status=InvestorObjectSyncStatus.draft,
    )
    payload = build_bank_account_payload(profile_id="invp_test", bank_row=bank_row, journey=journey)

    assert payload["account_number"] == "123456789012"
    assert payload["primary_account_holder_name"] == "Asha Patel"


def test_build_phone_payload_strips_plus_from_isd() -> None:
    phone_row = InvestorPhoneNumber(
        investor_profile_id=_sample_user().id,
        isd="+91",
        number="9876543210",
        source=InvestorObjectSource.user,
        sync_status=InvestorObjectSyncStatus.draft,
    )
    payload = build_phone_payload(profile_id="invp_test", phone_row=phone_row)
    assert payload["isd"] == "91"
    assert payload["number"] == "9876543210"


def test_build_related_party_payload_maps_grandfather() -> None:
    party = InvestorRelatedParty(
        investor_profile_id=_sample_user().id,
        name="Grandpa",
        party_relationship="grandfather",
        source=InvestorObjectSource.kyc,
        sync_status=InvestorObjectSyncStatus.draft,
    )
    payload = build_related_party_payload(profile_id="invp_test", party_row=party)
    assert payload["relationship"] == "grand_father"
