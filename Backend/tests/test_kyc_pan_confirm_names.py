from __future__ import annotations

import pytest

from app.application.kyc.errors import KycError
from app.application.kyc.pan_verification_service import (
    _compose_full_name,
    _normalize_name_key,
    confirm_pan_names,
)
from app.infrastructure.persistence.models import KycJourneyState, User


def test_compose_full_name_includes_middle_name() -> None:
    assert _compose_full_name(first_name="POOJA", middle_name="K", last_name="DHAMELIYA") == "POOJA K DHAMELIYA"


def test_normalize_name_key_collapses_whitespace_and_case() -> None:
    assert _normalize_name_key("  pooja   dhameliya ") == "POOJA DHAMELIYA"


@pytest.mark.asyncio
async def test_confirm_pan_names_updates_split_without_revalidation(db_session) -> None:
    user = User(email="pan-confirm@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "EPBPS6369E",
            "firstName": "POOJA",
            "lastName": "DHAMELIYA",
            "middleName": "",
            "fullName": "POOJA DHAMELIYA",
            "dateOfBirth": "1990-02-19",
            "panCategory": "individual",
        },
        poa_pan_preverify_id="pv_existing",
    )
    db_session.add(journey)
    await db_session.flush()

    result = await confirm_pan_names(
        db_session,
        user=user,
        first_name="POOJA",
        middle_name="",
        last_name="DHAMELIYA",
    )

    assert result["success"] is True
    assert result["panDraft"]["firstName"] == "POOJA"
    assert result["panDraft"]["fullName"] == "POOJA DHAMELIYA"
    await db_session.refresh(journey)
    assert journey.pan_draft_json["firstName"] == "POOJA"
    assert journey.poa_pan_preverify_id == "pv_existing"
    await db_session.refresh(user)
    assert user.first_name == "POOJA"
    assert user.last_name == "DHAMELIYA"


@pytest.mark.asyncio
async def test_confirm_pan_names_syncs_name_for_mitra_onboarded_user(db_session) -> None:
    user = User(email="mitra-client@example.com", phone="9876543210")
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "EOCPA3056Q",
            "firstName": "HARSHIT",
            "lastName": "KUSHWAH",
            "middleName": "",
            "fullName": "HARSHIT KUSHWAH",
            "dateOfBirth": "1995-01-01",
            "panCategory": "individual",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    result = await confirm_pan_names(
        db_session,
        user=user,
        first_name="HARSHIT",
        middle_name="",
        last_name="KUSHWAH",
    )

    assert result["success"] is True
    await db_session.refresh(user)
    assert user.first_name == "HARSHIT"
    assert user.last_name == "KUSHWAH"


@pytest.mark.asyncio
async def test_confirm_pan_names_revalidates_when_full_name_changes(db_session, monkeypatch) -> None:
    user = User(email="pan-revalidate@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "EPBPS6369E",
            "firstName": "POOJA",
            "lastName": "DHAMELIYA",
            "middleName": "",
            "fullName": "POOJA DHAMELIYA",
            "dateOfBirth": "1990-02-19",
            "panCategory": "individual",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    async def fake_poa_validate(**kwargs: object) -> dict[str, object]:
        assert kwargs["full_name"] == "POOJA KUMAR DHAMELIYA"
        return {
            "id": "pv_revalidated",
            "status": "completed",
            "pan": {"status": "verified"},
            "name": {"status": "verified"},
            "date_of_birth": {"status": "verified"},
        }

    monkeypatch.setattr(
        "app.application.kyc.pan_verification_service.poa_validate_pan_name_dob",
        fake_poa_validate,
    )

    result = await confirm_pan_names(
        db_session,
        user=user,
        first_name="POOJA",
        middle_name="KUMAR",
        last_name="DHAMELIYA",
    )

    assert result["success"] is True
    assert result["panDraft"]["fullName"] == "POOJA KUMAR DHAMELIYA"
    await db_session.refresh(journey)
    assert journey.poa_pan_preverify_id == "pv_revalidated"


@pytest.mark.asyncio
async def test_confirm_pan_names_allows_single_word_registry_name(db_session) -> None:
    user = User(email="pan-single@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "ABCDE1234F",
            "firstName": "ARUN",
            "lastName": "",
            "middleName": "",
            "fullName": "ARUN",
            "singleNameOnly": True,
            "dateOfBirth": "1990-02-19",
            "panCategory": "individual",
        },
        poa_pan_preverify_id="pv_existing",
    )
    db_session.add(journey)
    await db_session.flush()

    result = await confirm_pan_names(
        db_session,
        user=user,
        first_name="ARUN",
        middle_name="",
        last_name="",
    )

    assert result["success"] is True
    assert result["panDraft"]["firstName"] == "ARUN"
    assert result["panDraft"]["lastName"] == ""
    assert result["panDraft"]["fullName"] == "ARUN"


@pytest.mark.asyncio
async def test_confirm_pan_names_requires_verified_pan(db_session) -> None:
    user = User(email="pan-unverified@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(user_id=user.id, pan_verification_status="pending")
    db_session.add(journey)
    await db_session.flush()

    with pytest.raises(KycError) as exc:
        await confirm_pan_names(
            db_session,
            user=user,
            first_name="POOJA",
            middle_name="",
            last_name="DHAMELIYA",
        )

    assert exc.value.code == "pan_not_verified"
