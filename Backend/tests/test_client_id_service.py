from __future__ import annotations

import pytest

from app.application.documents.client_id_service import (
    build_client_id_candidate,
    with_collision_suffix,
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
