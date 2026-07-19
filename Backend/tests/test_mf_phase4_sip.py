from __future__ import annotations

from app.application.mf.mf_fp_state import map_fp_mandate_status, map_fp_plan_state


def test_map_fp_plan_state_active() -> None:
    from app.infrastructure.persistence.mf_transaction_models import MfSipPlanStatus

    assert map_fp_plan_state("active") == MfSipPlanStatus.active
    assert map_fp_plan_state("review_completed") == MfSipPlanStatus.consent_pending


def test_map_fp_mandate_status_approved() -> None:
    from app.infrastructure.persistence.mf_transaction_models import MfMandateStatus

    assert map_fp_mandate_status("APPROVED") == MfMandateStatus.approved
    assert map_fp_mandate_status("ACTIVE") == MfMandateStatus.approved
    assert map_fp_mandate_status("CREATED") == MfMandateStatus.auth_pending
