from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

_TERMINAL_KYC_FORM_STATUSES = frozenset(
    {"failed", "expired", "submitted", "archived", "unbound"},
)


def is_partner_kyc_form_id(form_id: str | None) -> bool:
    clean = str(form_id or "").strip()
    return clean.startswith("kycf_")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ref_is_reusable_kyc_form(row: dict[str, Any]) -> bool:
    if row.get("kind") != "kyc_form":
        return False
    if row.get("archived"):
        return False
    form_id = str(row.get("external_id") or "")
    if not is_partner_kyc_form_id(form_id):
        return False
    status = str(row.get("status") or "").lower()
    return status not in _TERMINAL_KYC_FORM_STATUSES


def append_kyc_partner_ref(
    journey: Any,
    *,
    kind: str,
    external_id: str,
    status: str | None = None,
    pan: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Append immutable partner identifiers (Cybrilla kyc_form, DigiLocker, etc.)."""
    clean_id = str(external_id or "").strip()
    if not clean_id:
        return

    refs: list[dict[str, Any]] = list(journey.kyc_partner_external_refs_json or [])
    for row in refs:
        if row.get("kind") == kind and row.get("external_id") == clean_id:
            if status and row.get("status") != status:
                row["status"] = status
                row["updated_at"] = _now_iso()
                journey.kyc_partner_external_refs_json = refs
            return

    entry: dict[str, Any] = {
        "kind": kind,
        "external_id": clean_id,
        "recorded_at": _now_iso(),
    }
    if status:
        entry["status"] = status
    if pan:
        entry["pan"] = pan.strip().upper()
    if extra:
        entry.update(extra)
    refs.append(entry)
    journey.kyc_partner_external_refs_json = refs


def archive_kyc_form_partner_ref(journey: Any, form_id: str, *, reason: str) -> None:
    clean_id = str(form_id or "").strip()
    if not clean_id:
        return
    refs: list[dict[str, Any]] = list(journey.kyc_partner_external_refs_json or [])
    updated = False
    for row in refs:
        if row.get("kind") == "kyc_form" and row.get("external_id") == clean_id:
            row["archived"] = True
            row["status"] = "archived"
            row["archive_reason"] = reason
            row["updated_at"] = _now_iso()
            updated = True
    if not updated:
        append_kyc_partner_ref(
            journey,
            kind="kyc_form",
            external_id=clean_id,
            status="archived",
            extra={"archived": True, "archive_reason": reason},
        )
        refs = list(journey.kyc_partner_external_refs_json or [])
        for row in refs:
            if row.get("kind") == "kyc_form" and row.get("external_id") == clean_id:
                row["archived"] = True
    else:
        journey.kyc_partner_external_refs_json = refs


def record_kyc_form_partner_ref(journey: Any, form: dict[str, Any]) -> None:
    form_id = str(form.get("id") or "").strip()
    if not form_id or not is_partner_kyc_form_id(form_id):
        return
    pan = str(form.get("pan") or (journey.pan_draft_json or {}).get("panNumber") or "")
    append_kyc_partner_ref(
        journey,
        kind="kyc_form",
        external_id=form_id,
        status=str(form.get("status") or "") or None,
        pan=pan or None,
        extra={
            "form_type": form.get("type"),
            "proof_fetch_url": (form.get("proof_details") or {}).get("fetch_url")
            if isinstance(form.get("proof_details"), dict)
            else None,
            "proof_status": (form.get("proof_details") or {}).get("status")
            if isinstance(form.get("proof_details"), dict)
            else None,
        },
    )


def latest_kyc_form_proof_fetch_url(journey: Any) -> str | None:
    refs: list[dict[str, Any]] = list(journey.kyc_partner_external_refs_json or [])
    for row in reversed(refs):
        if row.get("kind") != "kyc_form" or row.get("archived"):
            continue
        url = row.get("proof_fetch_url")
        if url:
            return str(url).strip() or None
    return None


def latest_partner_ref_id(journey: Any, *, kind: str) -> str | None:
    refs: list[dict[str, Any]] = list(journey.kyc_partner_external_refs_json or [])
    for row in reversed(refs):
        if row.get("kind") != kind or row.get("archived"):
            continue
        clean = str(row.get("external_id") or "").strip()
        if clean:
            return clean
    return None


def find_journey_esign_lookup_ids(journey: Any) -> set[str]:
    ids: set[str] = set()
    if journey.external_kyc_form_id:
        ids.add(str(journey.external_kyc_form_id))
    if journey.external_kyc_request_id:
        ids.add(str(journey.external_kyc_request_id))
    esign_id = latest_partner_ref_id(journey, kind="esign")
    if esign_id:
        ids.add(esign_id)
    return ids


def find_reusable_kyc_form_id_for_pan(journey: Any, pan: str) -> str | None:
    clean_pan = pan.strip().upper()
    if not clean_pan:
        return None
    refs: list[dict[str, Any]] = list(journey.kyc_partner_external_refs_json or [])
    for row in reversed(refs):
        if str(row.get("pan") or "").upper() != clean_pan:
            continue
        if not _ref_is_reusable_kyc_form(row):
            continue
        return str(row.get("external_id"))
    return None
