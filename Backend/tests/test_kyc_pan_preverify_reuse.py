from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.kyc.errors import KycError
from app.application.kyc.pan_verification_service import verify_pan
from app.infrastructure.persistence.models import KycJourneyState, User, UserRole, UserStatus

_MODULE = "app.application.kyc.pan_verification_service"


def _pan() -> str:
    return f"ABCPX{uuid4().int % 10000:04d}F"


def _pan_result(preverify_id: str, *, dob_status: str = "verified") -> dict[str, object]:
    return {
        "id": preverify_id,
        "status": "completed",
        "pan": {"status": "verified"},
        "name": {"status": "verified"},
        "date_of_birth": {
            "status": dob_status,
            "code": None if dob_status == "verified" else dob_status,
            "reason": None if dob_status == "verified" else "Date of birth does not match PAN records.",
        },
    }


@pytest.fixture
def poa_calls(monkeypatch):
    calls: dict[str, list] = {"readiness": [], "validate": [], "fetch_readiness": [], "fetch_pan": []}
    counter = {"n": 0}

    async def _allow_pan(*_args, **_kwargs):
        return None

    async def _readiness(pan):
        calls["readiness"].append(pan)
        counter["n"] += 1
        return {
            "id": f"pv_ready_{counter['n']}",
            "status": "completed",
            "readiness": {"status": "failed", "code": "kyc_unavailable", "reason": "Fresh KYC"},
        }

    async def _validate(*, pan_number, full_name, date_of_birth):
        calls["validate"].append((pan_number, full_name, date_of_birth))
        counter["n"] += 1
        status = "mismatch" if date_of_birth == "2000-01-01" else "verified"
        return _pan_result(f"pv_pan_{counter['n']}", dob_status=status)

    async def _fetch_readiness(preverify_id, *, pan_number):
        calls["fetch_readiness"].append(preverify_id)
        return {
            "id": preverify_id,
            "status": "completed",
            "readiness": {"status": "failed", "code": "kyc_unavailable", "reason": "Fresh KYC"},
        }

    async def _fetch_pan(preverify_id, *, pan_number, full_name, date_of_birth):
        calls["fetch_pan"].append(preverify_id)
        status = "mismatch" if date_of_birth == "2000-01-01" else "verified"
        return _pan_result(preverify_id, dob_status=status)

    monkeypatch.setattr(f"{_MODULE}.assert_pan_not_used_by_other_user", _allow_pan)
    monkeypatch.setattr(f"{_MODULE}.notify_kyc_initiated", lambda **_kwargs: None)
    monkeypatch.setattr(f"{_MODULE}.poa_check_readiness", _readiness)
    monkeypatch.setattr(f"{_MODULE}.poa_validate_pan_name_dob", _validate)
    monkeypatch.setattr(f"{_MODULE}.poa_fetch_readiness", _fetch_readiness)
    monkeypatch.setattr(f"{_MODULE}.poa_fetch_pan_validation", _fetch_pan)
    return calls


async def _user(db_session) -> User:
    user = User(
        id=uuid4(),
        email=f"pan-reuse-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _journey(db_session, user: User) -> KycJourneyState:
    journey = await db_session.get(KycJourneyState, user.id)
    assert journey is not None
    await db_session.refresh(journey)
    return journey


@pytest.mark.asyncio
async def test_same_inputs_reuse_preverification_ids(db_session, poa_calls) -> None:
    user = await _user(db_session)
    pan = _pan()

    first = await verify_pan(
        db_session, user=user, pan_number=pan, full_name="Harshit Kushwah", date_of_birth="2000-01-01"
    )
    assert first["blocked"] is True
    assert first["failure"]["field"] == "date_of_birth"
    assert first["failure"]["status"] == "mismatch"
    journey = await _journey(db_session, user)
    first_pan_id = journey.poa_pan_preverify_id
    first_ready_id = journey.poa_readiness_preverify_id

    again = await verify_pan(
        db_session, user=user, pan_number=pan, full_name="  harshit   KUSHWAH ", date_of_birth="2000-01-01"
    )
    assert again["blocked"] is True
    journey = await _journey(db_session, user)
    assert journey.poa_pan_preverify_id == first_pan_id
    assert journey.poa_readiness_preverify_id == first_ready_id
    assert len(poa_calls["validate"]) == 1
    assert len(poa_calls["readiness"]) == 1
    assert poa_calls["fetch_pan"] == [first_pan_id]

    fixed = await verify_pan(
        db_session, user=user, pan_number=pan, full_name="Harshit Kushwah", date_of_birth="1995-01-01"
    )
    assert fixed["success"] is True
    journey = await _journey(db_session, user)
    assert journey.poa_pan_preverify_id != first_pan_id
    assert journey.poa_readiness_preverify_id == first_ready_id
    assert len(poa_calls["validate"]) == 2
    assert len(poa_calls["readiness"]) == 1


@pytest.mark.asyncio
async def test_new_pan_creates_new_readiness(db_session, poa_calls) -> None:
    user = await _user(db_session)
    await verify_pan(db_session, user=user, pan_number=_pan(), full_name="Seetharam S", date_of_birth="1992-09-12")
    await verify_pan(db_session, user=user, pan_number=_pan(), full_name="Seetharam S", date_of_birth="1992-09-12")
    assert len(poa_calls["readiness"]) == 2
    assert len(poa_calls["validate"]) == 2


@pytest.mark.asyncio
async def test_single_full_name_is_split_into_draft(db_session, poa_calls) -> None:
    user = await _user(db_session)
    result = await verify_pan(
        db_session, user=user, pan_number=_pan(), full_name="Pooja Kumar Dhameliya", date_of_birth="1990-02-19"
    )
    draft = result["panDraft"]
    assert (draft["firstName"], draft["middleName"], draft["lastName"]) == ("Pooja", "Kumar", "Dhameliya")
    assert draft["fullName"] == "Pooja Kumar Dhameliya"
    assert "panCategory" not in draft


@pytest.mark.asyncio
@pytest.mark.parametrize("pan", ["ABCDE1234", "1BCDE1234F", "ABCDE12345", "ABCD11234F"])
async def test_invalid_pan_format_is_rejected(db_session, poa_calls, pan) -> None:
    user = await _user(db_session)
    with pytest.raises(KycError) as exc:
        await verify_pan(db_session, user=user, pan_number=pan, full_name="Harshit Kushwah", date_of_birth="1995-01-01")
    assert exc.value.code == "invalid_pan"
    assert poa_calls["readiness"] == []
