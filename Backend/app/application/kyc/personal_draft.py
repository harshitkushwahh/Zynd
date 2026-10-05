from __future__ import annotations

from typing import Any

from app.application.kyc.errors import KycError

MARITAL_STATUS_LOCKED_KEY = "maritalStatusLocked"


def is_married_status(value: object) -> bool:
    return str(value or "").strip().lower() == "married"


def is_marital_status_locked(draft: dict[str, Any] | None) -> bool:
    if not isinstance(draft, dict):
        return False
    return bool(draft.get(MARITAL_STATUS_LOCKED_KEY))


def lock_marital_status_on_journey(journey: Any) -> None:
    personal = dict(journey.personal_draft_json or {})
    personal[MARITAL_STATUS_LOCKED_KEY] = True
    journey.personal_draft_json = personal


def normalize_personal_draft(draft: dict[str, Any]) -> dict[str, Any]:
    out = dict(draft)
    marital = str(out.get("maritalStatus") or out.get("marital_status") or "").strip()
    spouse = str(out.get("spouseName") or out.get("spouse_name") or "").strip()
    locked = is_marital_status_locked(out)
    if is_married_status(marital):
        out["spouseName"] = spouse
    elif locked:
        out["spouseName"] = spouse
        out["maritalStatus"] = "married"
    else:
        out["spouseName"] = ""
    if locked:
        out[MARITAL_STATUS_LOCKED_KEY] = True
    return out


def validate_personal_draft(
    draft: dict[str, Any],
    *,
    journey_marital_locked: bool = False,
) -> None:
    locked = journey_marital_locked or is_marital_status_locked(draft)
    marital = str(draft.get("maritalStatus") or draft.get("marital_status") or "").strip()
    if locked and not is_married_status(marital):
        raise KycError(
            "Marital status cannot be changed to unmarried after spouse details were sent for eSign.",
            "marital_status_locked",
            400,
        )
    if not is_married_status(marital):
        return
    spouse = str(draft.get("spouseName") or draft.get("spouse_name") or "").strip()
    if not spouse:
        raise KycError("Enter your spouse's name.", "spouse_name_required", 400)
