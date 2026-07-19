from __future__ import annotations

from uuid import uuid4

from app.application.mf.mf_folio_defaults_service import build_folio_defaults
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
    InvestorEmailAddress,
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorPhoneNumber,
    InvestorProfile,
    InvestorRelatedParty,
)


def test_build_folio_defaults_includes_nominees() -> None:
    user_id = uuid4()
    profile = InvestorProfile(user_id=user_id)
    profile.email_addresses = [
        InvestorEmailAddress(
            investor_profile_id=user_id,
            email="user@example.com",
            external_email_id="email_1",
            sync_status=InvestorObjectSyncStatus.active,
            source=InvestorObjectSource.user,
        )
    ]
    profile.phone_numbers = [
        InvestorPhoneNumber(
            investor_profile_id=user_id,
            isd="91",
            number="9876543210",
            external_phone_id="phone_1",
            sync_status=InvestorObjectSyncStatus.active,
            source=InvestorObjectSource.user,
        )
    ]
    profile.addresses = [
        InvestorAddress(
            investor_profile_id=user_id,
            line1="Line 1",
            postal_code="560001",
            country="IN",
            external_address_id="addr_1",
            sync_status=InvestorObjectSyncStatus.active,
            source=InvestorObjectSource.kyc,
        )
    ]
    profile.bank_accounts = [
        InvestorBankAccount(
            investor_profile_id=user_id,
            account_type="savings",
            account_number_last4="9012",
            ifsc_code="HDFC0001234",
            primary_account_holder_name="User",
            external_bank_account_id="bac_1",
            external_old_id=12,
            sync_status=InvestorObjectSyncStatus.active,
            source=InvestorObjectSource.kyc,
        )
    ]
    profile.related_parties = [
        InvestorRelatedParty(
            investor_profile_id=user_id,
            name="Nominee",
            party_relationship="spouse",
            external_related_party_id="relp_1",
            share_percent=100,
            sync_status=InvestorObjectSyncStatus.active,
            source=InvestorObjectSource.kyc,
        )
    ]

    folio = build_folio_defaults(profile)
    assert folio["communication_email_address"] == "email_1"
    assert folio["payout_bank_account"] == "bac_1"
    assert folio["nominee1"] == "relp_1"
    assert folio["nominee1_allocation_percentage"] == 100
