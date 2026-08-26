from __future__ import annotations

from app.application.kyc.user_name_sync_service import names_from_pan_draft, sync_user_name_from_verified_kyc


def test_names_from_pan_draft_uses_structured_fields() -> None:
    first, middle, last = names_from_pan_draft(
        {"firstName": "HARSHIT", "middleName": "K", "lastName": "KUSHWAH", "fullName": "IGNORED"},
    )
    assert first == "HARSHIT"
    assert middle == "K"
    assert last == "KUSHWAH"


def test_names_from_pan_draft_splits_full_name() -> None:
    first, middle, last = names_from_pan_draft({"fullName": "HARSHIT K KUSHWAH"})
    assert first == "HARSHIT"
    assert middle == "K"
    assert last == "KUSHWAH"


def test_names_from_pan_draft_returns_none_without_name() -> None:
    assert names_from_pan_draft({}) == (None, None, None)


def test_names_from_pan_draft_uses_first_name_when_last_missing() -> None:
    first, middle, last = names_from_pan_draft({"firstName": "HARSHIT", "lastName": ""})
    assert first == "HARSHIT"
    assert middle is None
    assert last is None


def test_names_from_pan_draft_supports_single_name_only() -> None:
    first, middle, last = names_from_pan_draft(
        {"firstName": "ARUN", "singleNameOnly": True},
    )
    assert first == "ARUN"
    assert middle is None
    assert last is None


async def test_sync_user_name_from_verified_kyc_updates_user(db_session) -> None:
    from uuid import uuid4

    from app.infrastructure.persistence.models import KycJourneyState, User

    user = User(
        id=uuid4(),
        email=f"name-sync-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
        first_name="Fake",
        middle_name=None,
        last_name="Name",
    )
    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "ABCPA3753D",
            "firstName": "HARSHIT",
            "lastName": "KUSHWAH",
            "fullName": "HARSHIT KUSHWAH",
        },
    )
    db_session.add(user)
    db_session.add(journey)
    await db_session.flush()

    changed = await sync_user_name_from_verified_kyc(db_session, user=user, journey=journey)

    assert changed is True
    assert user.first_name == "HARSHIT"
    assert user.last_name == "KUSHWAH"
