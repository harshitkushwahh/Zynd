from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.infrastructure.persistence.models import KycJourneyState, UserKycStatus

KYC_FLOW_STEP_KEYS: tuple[str, ...] = (
    "pan",
    "digilocker",
    "address",
    "personal",
    "nominee",
    "bank",
    "signature",
    "esign",
    "review",
)

KYC_STEP_LABELS: dict[str, str] = {
    "pan": "PAN verification",
    "digilocker": "DigiLocker",
    "address": "Address",
    "personal": "Personal details",
    "nominee": "Nominee",
    "bank": "Bank account",
    "signature": "Signature",
    "esign": "eSign",
    "review": "Review & submit",
}

SUCCESS_ESIGN_STATUSES = {"success", "completed", "verified", "signed"}
FAILED_ESIGN_STATUSES = {"failed", "failure", "error"}
SUCCESS_EXTERNAL_KYC_STATUSES = {"returned_success", "success", "completed", "verified"}


def _step_label(step_key: str) -> str:
    return KYC_STEP_LABELS.get(step_key, step_key.replace("_", " ").title())


def _format_failure_payload(payload: dict[str, Any] | None) -> str | None:
    if not payload:
        return None
    for key in ("message", "reason", "detail", "error"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def derive_esign_step_status(
    journey: KycJourneyState | None,
    status: UserKycStatus | None,
) -> str:
    if journey is not None and journey.kyc_already_registered:
        return "skipped"
    signature_status = status.signature_step_status.value if status else "pending"
    if signature_status == "skipped":
        return "skipped"
    esign_status = (journey.esign_details_status or "").lower() if journey else ""
    if esign_status in SUCCESS_ESIGN_STATUSES:
        return "verified"
    if esign_status in FAILED_ESIGN_STATUSES:
        return "failed"
    return "pending"


def build_compliance_issues(
    journey: KycJourneyState | None,
    step_statuses: dict[str, str],
) -> list[dict[str, Any]]:
    if journey is None:
        return []

    issues: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    def push(
        *,
        issue_id: str,
        step_key: str,
        severity: str,
        title: str,
        detail: str,
        status: str = "open",
    ) -> None:
        key = (step_key, title)
        if key in seen:
            return
        seen.add(key)
        issues.append(
            {
                "id": issue_id,
                "step_key": step_key,
                "step_label": _step_label(step_key),
                "severity": severity,
                "title": title,
                "detail": detail,
                "status": status,
            }
        )

    pan_failure = _format_failure_payload(journey.pan_verification_failure_json)
    if journey.pan_verification_status == "failed" or step_statuses.get("pan") == "failed":
        push(
            issue_id="pan-verification",
            step_key="pan",
            severity="high",
            title="PAN verification failed",
            detail=pan_failure or journey.readiness_reason or "PAN could not be verified.",
        )

    if journey.digilocker_failure_reason:
        push(
            issue_id="digilocker",
            step_key="digilocker",
            severity="high",
            title="DigiLocker fetch failed",
            detail=journey.digilocker_failure_reason,
        )

    bank_failure = _format_failure_payload(journey.bank_verification_failure_json)
    if journey.bank_verification_status == "failed" or step_statuses.get("bank") == "failed":
        push(
            issue_id="bank-verification",
            step_key="bank",
            severity="high",
            title="Bank verification failed",
            detail=bank_failure or "Bank account could not be verified.",
        )

    if journey.kyc_form_failure_reason:
        push(
            issue_id="kyc-form",
            step_key="review",
            severity="high",
            title="KYC form submission failed",
            detail=journey.kyc_form_failure_reason,
        )

    external_status = (journey.external_kyc_status or "").lower()
    if external_status and external_status not in SUCCESS_EXTERNAL_KYC_STATUSES:
        push(
            issue_id="external-kyc",
            step_key="digilocker",
            severity="medium",
            title="External KYC pending or failed",
            detail=f"Provider status: {journey.external_kyc_status}",
        )

    if (journey.esign_details_status or "").lower() in FAILED_ESIGN_STATUSES:
        push(
            issue_id="esign",
            step_key="esign",
            severity="high",
            title="eSign failed",
            detail="Electronic signature could not be completed.",
        )

    if (journey.proof_details_status or "").lower() in FAILED_ESIGN_STATUSES:
        push(
            issue_id="proof-details",
            step_key="review",
            severity="medium",
            title="Proof details failed",
            detail="Supporting proof details could not be validated.",
        )

    for step_key in KYC_FLOW_STEP_KEYS:
        if step_statuses.get(step_key) != "failed":
            continue
        push(
            issue_id=f"step-{step_key}",
            step_key=step_key,
            severity="medium",
            title=f"{_step_label(step_key)} needs attention",
            detail=f"The {_step_label(step_key).lower()} step is marked as failed.",
        )

    return issues


def _audit_entry(
    *,
    occurred_at: datetime,
    action: str,
    step_key: str | None = None,
    detail: str,
    actor: str = "system",
    source: str = "System",
) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "occurred_at": occurred_at.isoformat(),
        "action": action,
        "step_key": step_key,
        "step_label": _step_label(step_key) if step_key else None,
        "detail": detail,
        "actor": actor,
        "source": source,
    }


def build_kyc_audit_log(
    *,
    journey: KycJourneyState | None,
    status: UserKycStatus | None,
    step_statuses: dict[str, str],
    documents: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    if journey is None:
        return entries

    if journey.created_at:
        entries.append(
            _audit_entry(
                occurred_at=journey.created_at,
                action="KYC initiated",
                detail="Investor started the KYC journey.",
                actor="investor",
                source="App",
            )
        )

    if journey.kyc_already_registered:
        entries.append(
            _audit_entry(
                occurred_at=journey.updated_at or journey.created_at or datetime.now(timezone.utc),
                action="KRA path confirmed",
                step_key="pan",
                detail=journey.readiness_reason
                or "Investor is KRA-compliant. DigiLocker, signature, and eSign are not required.",
                actor="system",
            )
        )

    for step_key in KYC_FLOW_STEP_KEYS:
        step_status = step_statuses.get(step_key, "pending")
        if step_status in {"verified", "completed", "skipped"}:
            entries.append(
                _audit_entry(
                    occurred_at=journey.updated_at or journey.created_at or datetime.now(timezone.utc),
                    action="Step completed" if step_status != "skipped" else "Step skipped",
                    step_key=step_key,
                    detail=f"{_step_label(step_key)} marked {step_status.replace('_', ' ')}.",
                    actor="investor" if step_status != "skipped" else "system",
                    source="App" if step_status != "skipped" else "System",
                )
            )
        elif step_status == "failed":
            entries.append(
                _audit_entry(
                    occurred_at=journey.updated_at or journey.created_at or datetime.now(timezone.utc),
                    action="Step needs attention",
                    step_key=step_key,
                    detail=f"{_step_label(step_key)} failed validation.",
                    actor="system",
                )
            )

    if journey.pan_verification_status == "failed":
        detail = _format_failure_payload(journey.pan_verification_failure_json) or "PAN verification failed."
        entries.append(
            _audit_entry(
                occurred_at=journey.updated_at or journey.created_at or datetime.now(timezone.utc),
                action="Verification failed",
                step_key="pan",
                detail=detail,
                actor="system",
            )
        )

    if journey.digilocker_failure_reason:
        entries.append(
            _audit_entry(
                occurred_at=journey.updated_at or journey.created_at or datetime.now(timezone.utc),
                action="DigiLocker failed",
                step_key="digilocker",
                detail=journey.digilocker_failure_reason,
                actor="system",
            )
        )

    if journey.bank_verification_status == "failed":
        detail = _format_failure_payload(journey.bank_verification_failure_json) or "Bank verification failed."
        entries.append(
            _audit_entry(
                occurred_at=journey.updated_at or journey.created_at or datetime.now(timezone.utc),
                action="Verification failed",
                step_key="bank",
                detail=detail,
                actor="system",
            )
        )

    if journey.kyc_form_failure_reason:
        entries.append(
            _audit_entry(
                occurred_at=journey.updated_at or journey.created_at or datetime.now(timezone.utc),
                action="KYC form failed",
                step_key="review",
                detail=journey.kyc_form_failure_reason,
                actor="system",
            )
        )

    if journey.external_kyc_status:
        entries.append(
            _audit_entry(
                occurred_at=journey.updated_at or journey.created_at or datetime.now(timezone.utc),
                action="External KYC update",
                step_key="digilocker",
                detail=f"Provider status: {journey.external_kyc_status}",
                actor="system",
                source="KRA provider",
            )
        )

    for document in documents:
        created_at_raw = document.get("created_at")
        if not created_at_raw:
            continue
        created_at = (
            created_at_raw
            if isinstance(created_at_raw, datetime)
            else datetime.fromisoformat(str(created_at_raw).replace("Z", "+00:00"))
        )
        doc_type = str(document.get("doc_type") or "document").replace("_", " ")
        entries.append(
            _audit_entry(
                occurred_at=created_at,
                action="Document uploaded",
                detail=f"{doc_type.title()} uploaded ({document.get('original_filename') or 'file'}).",
                actor="investor",
                source="App",
            )
        )

    review_status = step_statuses.get("review")
    overall_status = step_statuses.get("overall")
    if review_status in {"verified", "completed"} or overall_status in {"submitted", "completed"}:
        entries.append(
            _audit_entry(
                occurred_at=journey.updated_at or journey.created_at or datetime.now(timezone.utc),
                action="KYC submitted",
                step_key="review",
                detail="Investor submitted KYC for final review.",
                actor="investor",
                source="App",
            )
        )

    if overall_status == "completed":
        entries.append(
            _audit_entry(
                occurred_at=status.updated_at if status else journey.updated_at,
                action="KYC approved",
                step_key="review",
                detail="KYC marked complete. Investor is onboarded.",
                actor="system",
            )
        )

    entries.sort(key=lambda entry: entry["occurred_at"], reverse=True)
    return entries
