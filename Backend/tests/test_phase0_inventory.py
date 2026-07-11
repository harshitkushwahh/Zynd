"""Phase 0 inventory guardrails."""

from __future__ import annotations

from app.application.admin.permission_matrix import (
    PERMISSION_ROUTE_MATRIX,
    matrix_permission_keys,
)
from app.application.admin.rbac_service import PERMISSIONS


def test_permission_matrix_covers_all_seeded_permissions() -> None:
    seeded = {key for key, _ in PERMISSIONS}
    matrix = matrix_permission_keys()
    missing = seeded - matrix
    extra = matrix - seeded
    assert not missing, f"Seeded permissions missing from matrix: {sorted(missing)}"
    assert not extra, f"Matrix has unknown permissions not in rbac seed: {sorted(extra)}"


def test_permission_matrix_entries_have_required_fields() -> None:
    allowed = {"enforced", "mismatch", "planned", "partial"}
    for entry in PERMISSION_ROUTE_MATRIX:
        assert entry["permission"]
        assert entry["status"] in allowed
        assert isinstance(entry["routes"], list)
        assert isinstance(entry["notes"], str) and entry["notes"].strip()
        if entry["status"] == "enforced":
            assert entry["routes"], f"{entry['permission']} is enforced but has no routes"
        if entry["status"] == "planned":
            assert entry["routes"] == [], f"{entry['permission']} is planned but lists routes"


def test_rbac_matrix_has_no_open_gaps() -> None:
    by_key = {entry["permission"]: entry for entry in PERMISSION_ROUTE_MATRIX}
    open_statuses = {"planned", "mismatch", "partial"}
    gaps = [
        entry["permission"]
        for entry in PERMISSION_ROUTE_MATRIX
        if entry["status"] in open_statuses
    ]
    assert not gaps, f"RBAC matrix still has open gaps: {gaps}"
    assert by_key["users.read"]["status"] == "enforced"
    assert by_key["users.suspend"]["status"] == "enforced"
    assert by_key["audit.read"]["status"] == "enforced"
    assert by_key["security.manage"]["status"] == "enforced"
    assert by_key["transactions.execute"]["status"] == "enforced"
    assert by_key["rbac.manage"]["status"] == "enforced"
