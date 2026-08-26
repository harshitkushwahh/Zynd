from __future__ import annotations

import pytest

from app.application.documents.client_id_service import (
    assign_client_id,
    build_client_id_candidate,
    build_zynd_persona_client_id,
    build_zynd_persona_initials,
    is_placeholder_client_id,
    is_zynd_persona_client_id,
    with_collision_suffix,
    ZYND_PERSONA_MANAGER,
    ZYND_PERSONA_MITRA,
)


def test_build_client_id_candidate_from_email_and_phone() -> None:
    assert build_client_id_candidate("rahul.sharma@example.com", "9876543210") == (
        "rahulsharma9876543210@zynd"
    )


def test_build_client_id_candidate_single_token_email() -> None:
    assert build_client_id_candidate("rahul@example.com", "9876543210") == "rahul9876543210@zynd"


def test_build_client_id_candidate_without_phone_uses_random_suffix() -> None:
    first = build_client_id_candidate("rahul@example.com", None)
    second = build_client_id_candidate("rahul@example.com", None)
    assert first.endswith("@zynd")
    assert second.endswith("@zynd")
    assert first != second


def test_with_collision_suffix() -> None:
    assert with_collision_suffix("rahul9876543210@zynd", 1) == "rahul9876543210@zynd"
    assert with_collision_suffix("rahul9876543210@zynd", 2) == "rahul9876543210-2@zynd"


def test_build_zynd_persona_initials() -> None:
    assert build_zynd_persona_initials("Harshit", "Kushwah") == "HK"
    assert build_zynd_persona_initials("Neha", "Patil") == "NP"


def test_build_zynd_persona_client_id() -> None:
    assert build_zynd_persona_client_id(
        first_name="Harshit",
        last_name="Kushwah",
        role_code=ZYND_PERSONA_MITRA,
        series=1,
    ) == "ZYND-M-HK001"
    assert build_zynd_persona_client_id(
        first_name="Neha",
        last_name="Patil",
        role_code=ZYND_PERSONA_MANAGER,
        series=2,
    ) == "ZYND-MG-NP002"


def test_is_placeholder_client_id() -> None:
    assert is_placeholder_client_id("test-abc123@zynd")
    assert not is_placeholder_client_id("harshitkushwah084646473737@zynd")
    assert not is_placeholder_client_id("ZYND-M-HK001")


async def test_assign_client_id_replaces_placeholder(db_session) -> None:
    from app.infrastructure.persistence.models import User, UserRole, UserStatus

    user = User(
        email="investor@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
        client_id="test-deadbeef@zynd",
    )
    db_session.add(user)
    await db_session.flush()
    assigned = await assign_client_id(db_session, user)
    assert assigned == "investor9876543210@zynd"
    assert user.client_id == "investor9876543210@zynd"


def test_is_zynd_persona_client_id() -> None:
    assert is_zynd_persona_client_id("ZYND-M-HK001", ZYND_PERSONA_MITRA)
    assert is_zynd_persona_client_id("ZYND-MG-NP001", ZYND_PERSONA_MANAGER)
    assert not is_zynd_persona_client_id("ZYND-MG-NP001", ZYND_PERSONA_MITRA)
    assert not is_zynd_persona_client_id("harshit5314@zynd", ZYND_PERSONA_MITRA)
