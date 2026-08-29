from __future__ import annotations

from types import SimpleNamespace

from app.application.admin.kyc_admin_detail_helpers import (
    apply_kra_skipped_step_statuses,
    build_compliance_issues,
)


def test_apply_kra_skipped_step_statuses_marks_pending_optional_steps() -> None:
    updated = apply_kra_skipped_step_statuses(
        {
            "pan": "verified",
            "digilocker": "pending",
            "nominee": "pending",
            "signature": "failed",
            "esign": "pending",
            "bank": "verified",
        },
        kyc_already_registered=True,
    )

    assert updated["pan"] == "verified"
    assert updated["bank"] == "verified"
    assert updated["digilocker"] == "skipped"
    assert updated["nominee"] == "skipped"
    assert updated["signature"] == "skipped"
    assert updated["esign"] == "skipped"


def test_apply_kra_skipped_step_statuses_keeps_completed_optional_steps() -> None:
    updated = apply_kra_skipped_step_statuses(
        {"nominee": "completed", "signature": "verified"},
        kyc_already_registered=True,
    )

    assert updated["nominee"] == "completed"
    assert updated["signature"] == "verified"


def test_apply_kra_skipped_step_statuses_is_noop_for_new_kyc() -> None:
    statuses = {"digilocker": "pending", "nominee": "pending"}
    assert apply_kra_skipped_step_statuses(statuses, kyc_already_registered=False) == statuses


def test_build_compliance_issues_skips_kra_optional_failures() -> None:
    journey = SimpleNamespace(
        kyc_already_registered=True,
        pan_verification_status="verified",
        pan_verification_failure_json=None,
        readiness_reason=None,
        digilocker_failure_reason="Aadhaar fetch failed",
        bank_verification_status="verified",
        bank_verification_failure_json=None,
        kyc_form_failure_reason=None,
        external_kyc_status="pending",
        esign_details_status="failed",
        proof_details_status=None,
    )

    issues = build_compliance_issues(journey, {"pan": "verified", "bank": "verified"})
    assert issues == []
