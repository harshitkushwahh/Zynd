from __future__ import annotations

import pytest

from app.application.kyc.journey_gate_service import require_phase1_complete
from app.application.kyc.journey_state_service import _step_index
from app.application.kyc.nominee_master_data import nominee_master_data_enums
from app.application.kyc.errors import KycError
from app.infrastructure.persistence.models import KycJourneyState


def test_step_index_includes_phase2_steps() -> None:
    assert _step_index("personal") == 3
    assert _step_index("nominee") == 4
    assert _step_index("bank") == 5
    assert _step_index("address") == 2


def test_nominee_master_data_has_expected_keys() -> None:
    enums = nominee_master_data_enums()
    assert "relationships" in enums
    assert "sourceOfWealth" in enums
    assert "documentTypes" in enums
    assert len(enums["relationships"]) >= 5


def test_require_phase1_complete_blocks_missing_personal() -> None:
    journey = KycJourneyState(user_id=None)  # type: ignore[arg-type]
    journey.personal_draft_json = None
    with pytest.raises(KycError) as exc:
        require_phase1_complete(journey)
    assert exc.value.code == "phase1_incomplete"


def test_require_phase1_complete_allows_personal_complete() -> None:
    journey = KycJourneyState(user_id=None)  # type: ignore[arg-type]
    journey.personal_draft_json = {"gender": "male"}
    journey.last_completed_step = "personal"
    require_phase1_complete(journey)
