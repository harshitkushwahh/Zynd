from __future__ import annotations

import base64
import re
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    DISTRIBUTOR_PARTNER_ROLE_KEY,
    assign_role_to_admin_user,
)
from app.application.auth.errors import AuthError
from app.application.distributor.distributor_auth_service import assert_distributor_console_access
from app.application.documents.client_id_service import (
    ZYND_PERSONA_MITRA,
    assign_zynd_persona_client_id,
)
from app.application.documents.document_image_validation import validate_profile_image_content
from app.application.documents.document_service import upload_user_document
from app.application.documents.errors import DocumentError
from app.application.identity.otp_purposes import OtpPurpose
from app.application.ports.otp_gateway import OtpCooldownError, OtpRateLimitError, request_otp, verify_otp
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.application.distributor.distributor_branch_service import (
    get_distributor_branch_by_id,
    get_distributor_branch_for_manager,
)
from app.infrastructure.persistence.distributor_partner_models import (
    DistributorPartner,
    DistributorPartnerStatus,
)
from app.infrastructure.persistence.models import AuditEventType, AuditLog, DocumentType, User, UserRole, UserStatus
from app.infrastructure.persistence.partner_onboarding_draft_store import (
    create_partner_onboarding_draft,
    delete_partner_onboarding_draft,
    delete_partner_onboarding_document,
    get_partner_onboarding_document,
    get_partner_onboarding_draft,
    get_partner_onboarding_profile_photo,
    set_partner_onboarding_document,
    set_partner_onboarding_profile_photo,
    update_partner_onboarding_draft,
)
from app.application.distributor.partner_onboarding_filenames import (
    partner_onboarding_document_filename,
    partner_onboarding_profile_photo_filename,
)
from app.infrastructure.security.rate_limit import check_rate_limit

_PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_IFSC_PATTERN = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


class PartnerOnboardingError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _otp_cooldown_error(exc: OtpCooldownError) -> PartnerOnboardingError:
    return PartnerOnboardingError(
        "Please wait before requesting another code.",
        "otp_cooldown",
        429,
    )


def _mask_pan(pan: str) -> str:
    normalized = pan.strip().upper()
    if len(normalized) < 4:
        return normalized
    return f"XXXXX{normalized[5:9]}X"


async def _assert_manager_can_onboard(db: AsyncSession, manager: User) -> None:
    from app.application.admin.rbac_service import list_user_role_keys

    role_keys = await list_user_role_keys(db, manager.id)
    try:
        assert_distributor_console_access(role_keys)
    except AuthError as exc:
        raise PartnerOnboardingError(exc.message, exc.code, exc.status_code) from exc
    if "distributor_manager" not in role_keys:
        raise PartnerOnboardingError(
            "Only branch managers can onboard Zynd Mitras.",
            "manager_required",
            403,
        )


async def _assert_email_available(db: AsyncSession, email: str) -> None:
    result = await db.execute(
        select(User).where(User.email == email, User.status != UserStatus.deleted)
    )
    if result.scalar_one_or_none():
        raise PartnerOnboardingError(
            "An account with this email already exists.",
            "email_already_registered",
            409,
        )


async def _assert_phone_available(db: AsyncSession, phone: str) -> None:
    result = await db.execute(
        select(User).where(User.phone == phone, User.status != UserStatus.deleted)
    )
    if result.scalar_one_or_none():
        raise PartnerOnboardingError(
            "This mobile number is already linked to another account.",
            "phone_already_registered",
            409,
        )


async def _load_draft(token: str) -> dict[str, Any]:
    draft = await get_partner_onboarding_draft(token)
    if not draft:
        raise PartnerOnboardingError(
            "Onboarding session expired. Please start again.",
            "onboarding_expired",
            410,
        )
    return draft


async def start_partner_onboarding(
    db: AsyncSession,
    *,
    manager: User,
    email: str,
    ip: str | None,
) -> dict[str, str | int]:
    await _assert_manager_can_onboard(db, manager)
    normalized = email.lower().strip()
    if "@" not in normalized:
        raise PartnerOnboardingError("Enter a valid work email.", "invalid_email", 400)

    if not await check_rate_limit(f"partner_onboarding:{ip or normalized}", 10, 3600):
        raise PartnerOnboardingError("Too many onboarding attempts. Try again later.", "rate_limited", 429)

    await _assert_email_available(db, normalized)

    try:
        otp_meta = await request_otp(OtpPurpose.partner_onboarding_email, normalized, ip=ip)
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise PartnerOnboardingError(str(exc), "rate_limited", 429) from exc

    token = await create_partner_onboarding_draft(
        email=normalized,
        manager_user_id=str(manager.id),
    )
    return {"onboarding_token": token, **otp_meta}


async def resend_partner_onboarding_email_otp(
    *,
    onboarding_token: str,
    ip: str | None,
) -> dict[str, int]:
    draft = await _load_draft(onboarding_token)
    if draft.get("email_verified"):
        raise PartnerOnboardingError("Email is already verified.", "email_already_verified", 400)
    try:
        return await request_otp(OtpPurpose.partner_onboarding_email, draft["email"], ip=ip)
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise PartnerOnboardingError(str(exc), "rate_limited", 429) from exc


async def verify_partner_onboarding_email(
    *,
    onboarding_token: str,
    otp: str,
) -> dict[str, bool]:
    draft = await _load_draft(onboarding_token)
    if not await verify_otp(OtpPurpose.partner_onboarding_email, draft["email"], otp):
        raise PartnerOnboardingError("Invalid or expired verification code.", "invalid_otp", 401)
    await update_partner_onboarding_draft(onboarding_token, {"email_verified": True})
    return {"verified": True}


async def send_partner_onboarding_mobile_otp(
    db: AsyncSession,
    *,
    onboarding_token: str,
    mobile: str,
    ip: str | None,
) -> dict[str, int]:
    draft = await _load_draft(onboarding_token)
    if not draft.get("email_verified"):
        raise PartnerOnboardingError("Verify the work email first.", "email_not_verified", 400)

    digits = re.sub(r"\D", "", mobile)
    if len(digits) != 10:
        raise PartnerOnboardingError("Enter a valid 10-digit mobile number.", "invalid_mobile", 400)

    await _assert_phone_available(db, digits)

    try:
        otp_meta = await request_otp(
            OtpPurpose.partner_onboarding_mobile,
            digits,
            ip=ip,
            destination=f"+91{digits}",
        )
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise PartnerOnboardingError(str(exc), "rate_limited", 429) from exc

    await update_partner_onboarding_draft(
        onboarding_token,
        {"mobile": digits, "mobile_verified": False},
    )
    return otp_meta


async def resend_partner_onboarding_mobile_otp(
    *,
    onboarding_token: str,
    ip: str | None,
) -> dict[str, int]:
    draft = await _load_draft(onboarding_token)
    mobile = draft.get("mobile")
    if not mobile:
        raise PartnerOnboardingError("Enter a mobile number first.", "mobile_missing", 400)
    if draft.get("mobile_verified"):
        raise PartnerOnboardingError("Mobile is already verified.", "mobile_already_verified", 400)
    try:
        return await request_otp(
            OtpPurpose.partner_onboarding_mobile,
            mobile,
            ip=ip,
            destination=f"+91{mobile}",
        )
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise PartnerOnboardingError(str(exc), "rate_limited", 429) from exc


async def verify_partner_onboarding_mobile(
    *,
    onboarding_token: str,
    otp: str,
) -> dict[str, bool]:
    draft = await _load_draft(onboarding_token)
    mobile = draft.get("mobile")
    if not mobile:
        raise PartnerOnboardingError("Enter a mobile number first.", "mobile_missing", 400)
    if not await verify_otp(OtpPurpose.partner_onboarding_mobile, mobile, otp):
        raise PartnerOnboardingError("Invalid or expired verification code.", "invalid_otp", 401)
    await update_partner_onboarding_draft(onboarding_token, {"mobile_verified": True})
    return {"verified": True}


async def _assert_manager_owns_draft(draft: dict[str, Any], manager: User) -> None:
    if str(draft.get("manager_user_id")) != str(manager.id):
        raise PartnerOnboardingError("Invalid onboarding session.", "onboarding_invalid", 403)


def _partner_list_status(partner_status: DistributorPartnerStatus) -> str:
    if partner_status == DistributorPartnerStatus.active:
        return "Active"
    if partner_status == DistributorPartnerStatus.pending_ho_review:
        return "Pending review"
    if partner_status == DistributorPartnerStatus.pending_password:
        return "Pending password"
    if partner_status == DistributorPartnerStatus.rejected:
        return "Rejected"
    return "Paused"


def _partner_public_id(user: User) -> str:
    return user.client_id or str(user.id)


def _mask_phone(phone: str | None) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) < 4:
        return digits or "—"
    return f"+91 {digits[-10:]}" if len(digits) >= 10 else digits


def _serialize_partner_list_item(
    *,
    partner: DistributorPartner,
    user: User,
    profile_image_url: str | None,
) -> dict[str, Any]:
    display_name = " ".join(
        part for part in [user.first_name, user.middle_name, user.last_name] if part
    ).strip()
    public_id = _partner_public_id(user)
    return {
        "id": public_id,
        "partner_id": str(partner.id),
        "user_id": str(user.id),
        "client_id": public_id,
        "name": display_name or user.email,
        "email": user.email,
        "arn": partner.arn or "",
        "client_count": 0,
        "aum": 0.0,
        "status": _partner_list_status(partner.status),
        "onboarding_status": partner.status.value,
        "joined_at": partner.created_at,
        "profile_image_url": profile_image_url,
    }


def _serialize_partner_detail(
    *,
    partner: DistributorPartner,
    user: User,
    branch_name: str,
    profile_image_url: str | None,
) -> dict[str, Any]:
    payload = partner.profile_payload or {}
    address = payload.get("address") or {}
    base = _serialize_partner_list_item(
        partner=partner,
        user=user,
        profile_image_url=profile_image_url,
    )
    base.update(
        {
            "mobile": _mask_phone(user.phone),
            "mobile_masked": _mask_phone(user.phone),
            "branch_id": partner.branch_id,
            "branch_name": branch_name,
            "euin": partner.euin or "—",
            "pan_masked": partner.pan_masked or "",
            "address": {
                "line1": address.get("line1") or "",
                "line2": address.get("line2") or "",
                "city": address.get("city") or "",
                "state": address.get("state") or "",
                "pincode": str(address.get("pincode") or ""),
                "country": address.get("country") or "India",
            },
            "active_sip_count": 0,
            "mtd_inflow": 0.0,
            "lumpsum_mtd": 0.0,
            "onboarding_complete_pct": 0,
        }
    )
    return base


async def upload_partner_onboarding_document(
    *,
    manager: User,
    onboarding_token: str,
    doc_type: str,
    filename: str,
    mime_type: str,
    content: bytes,
) -> dict[str, str | bool]:
    draft = await _load_draft(onboarding_token)
    await _assert_manager_owns_draft(draft, manager)
    if not draft.get("email_verified") or not draft.get("mobile_verified"):
        raise PartnerOnboardingError(
            "Verify email and mobile before uploading documents.",
            "contact_not_verified",
            400,
        )

    normalized_type = doc_type.strip().lower()
    if normalized_type not in {"pan", "aadhaar"}:
        raise PartnerOnboardingError("Unsupported document type.", "invalid_document_type", 400)

    allowed_mimes = {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
    }
    if mime_type not in allowed_mimes:
        raise PartnerOnboardingError("Use PDF, JPG, PNG, or WEBP.", "invalid_mime_type", 400)

    settings = get_settings()
    if len(content) > settings.documents_max_bytes:
        raise PartnerOnboardingError("File is too large.", "file_too_large", 413)
    if not content:
        raise PartnerOnboardingError("Uploaded file is empty.", "empty_file", 400)

    safe_name = partner_onboarding_document_filename(
        draft,
        doc_type=normalized_type,
        mime_type=mime_type,
    )
    content_b64 = base64.b64encode(content).decode("ascii")
    await set_partner_onboarding_document(
        onboarding_token,
        doc_type=normalized_type,
        content_b64=content_b64,
        mime_type=mime_type,
        file_name=safe_name,
    )

    documents = dict(draft.get("documents") or {})
    if normalized_type == "pan":
        documents["pan_file_name"] = safe_name
        documents["pan_uploaded"] = True
    else:
        documents["aadhaar_file_name"] = safe_name
        documents["aadhaar_uploaded"] = True

    await update_partner_onboarding_draft(onboarding_token, {"documents": documents})
    return {"uploaded": True, "file_name": safe_name, "doc_type": normalized_type}


async def clear_partner_onboarding_document(
    *,
    manager: User,
    onboarding_token: str,
    doc_type: str,
) -> dict[str, bool]:
    draft = await _load_draft(onboarding_token)
    await _assert_manager_owns_draft(draft, manager)
    normalized_type = doc_type.strip().lower()
    if normalized_type not in {"pan", "aadhaar"}:
        raise PartnerOnboardingError("Unsupported document type.", "invalid_document_type", 400)
    await delete_partner_onboarding_document(onboarding_token, normalized_type)
    documents = dict(draft.get("documents") or {})
    if normalized_type == "pan":
        documents["pan_file_name"] = None
        documents["pan_uploaded"] = False
    else:
        documents["aadhaar_file_name"] = None
        documents["aadhaar_uploaded"] = False
    await update_partner_onboarding_draft(onboarding_token, {"documents": documents})
    return {"cleared": True}


async def upload_partner_onboarding_profile_photo(
    *,
    manager: User,
    onboarding_token: str,
    filename: str,
    mime_type: str,
    content: bytes,
) -> dict[str, str | bool]:
    draft = await _load_draft(onboarding_token)
    await _assert_manager_owns_draft(draft, manager)
    if not draft.get("email_verified") or not draft.get("mobile_verified"):
        raise PartnerOnboardingError(
            "Verify email and mobile before uploading a profile photo.",
            "contact_not_verified",
            400,
        )

    try:
        normalized, normalized_mime = validate_profile_image_content(content)
    except DocumentError as exc:
        raise PartnerOnboardingError(exc.message, exc.code, exc.status_code) from exc

    safe_name = partner_onboarding_profile_photo_filename(
        draft,
        mime_type=normalized_mime,
    )
    content_b64 = base64.b64encode(normalized).decode("ascii")
    await set_partner_onboarding_profile_photo(
        onboarding_token,
        content_b64=content_b64,
        mime_type=normalized_mime,
        file_name=safe_name,
    )
    await update_partner_onboarding_draft(
        onboarding_token,
        {"profile_photo": {"uploaded": True, "file_name": safe_name}},
    )
    return {"uploaded": True, "file_name": safe_name}


async def clear_partner_onboarding_profile_photo(
    *,
    manager: User,
    onboarding_token: str,
) -> dict[str, bool]:
    draft = await _load_draft(onboarding_token)
    await _assert_manager_owns_draft(draft, manager)
    from app.infrastructure.persistence.partner_onboarding_draft_store import (
        delete_partner_onboarding_profile_photo,
    )

    await delete_partner_onboarding_profile_photo(onboarding_token)
    await update_partner_onboarding_draft(onboarding_token, {"profile_photo": None})
    return {"cleared": True}


async def update_partner_onboarding_draft_fields(
    *,
    onboarding_token: str,
    payload: dict[str, Any],
) -> dict[str, bool]:
    draft = await _load_draft(onboarding_token)
    if not draft.get("email_verified") or not draft.get("mobile_verified"):
        raise PartnerOnboardingError(
            "Verify email and mobile before continuing.",
            "contact_not_verified",
            400,
        )

    updates: dict[str, Any] = {}
    if "pan" in payload:
        pan = str(payload["pan"] or "").strip().upper()
        if pan and not _PAN_PATTERN.fullmatch(pan):
            raise PartnerOnboardingError("Enter a valid PAN.", "invalid_pan", 400)
        updates["pan"] = pan or None
        if "pan_verified_name" in payload:
            updates["pan_verified_name"] = payload.get("pan_verified_name")
        if pan and not draft.get("pan_verified"):
            updates["pan_verified"] = False

    for field in ("first_name", "middle_name", "last_name"):
        if field in payload:
            value = str(payload[field] or "").strip()
            updates[field] = value or None

    if "bank" in payload and payload["bank"] is not None:
        bank = payload["bank"]
        ifsc = str(bank.get("ifsc") or "").strip().upper()
        if ifsc and not _IFSC_PATTERN.fullmatch(ifsc):
            raise PartnerOnboardingError("Enter a valid IFSC code.", "invalid_ifsc", 400)
        updates["bank"] = bank
        if not draft.get("bank_verified"):
            updates["bank_verified"] = False

    if "address" in payload and payload["address"] is not None:
        updates["address"] = payload["address"]

    if "documents" in payload and payload["documents"] is not None:
        existing_documents = dict(draft.get("documents") or {})
        existing_documents.update(payload["documents"])
        updates["documents"] = existing_documents

    if updates:
        await update_partner_onboarding_draft(onboarding_token, updates)
    return {"ok": True}


def _serialize_partner_onboarding_draft(draft: dict[str, Any]) -> dict[str, Any]:
    bank = draft.get("bank") or {}
    address = draft.get("address") or {}
    documents = draft.get("documents") or {}
    profile_photo = draft.get("profile_photo") or {}
    return {
        "email": draft.get("email"),
        "email_verified": bool(draft.get("email_verified")),
        "mobile": draft.get("mobile"),
        "mobile_verified": bool(draft.get("mobile_verified")),
        "pan": draft.get("pan"),
        "pan_verified": bool(draft.get("pan_verified")),
        "pan_verified_name": draft.get("pan_verified_name"),
        "first_name": draft.get("first_name"),
        "middle_name": draft.get("middle_name"),
        "last_name": draft.get("last_name"),
        "bank_verified": bool(draft.get("bank_verified")),
        "bank": bank if bank else None,
        "address": address if address else None,
        "documents": {
            "pan_file_name": documents.get("pan_file_name"),
            "aadhaar_file_name": documents.get("aadhaar_file_name"),
            "pan_uploaded": bool(documents.get("pan_uploaded")),
            "aadhaar_uploaded": bool(documents.get("aadhaar_uploaded")),
        },
        "profile_photo": {
            "uploaded": bool(profile_photo.get("uploaded")),
            "file_name": profile_photo.get("file_name"),
        },
    }


async def get_partner_onboarding_draft_snapshot(
    *,
    manager: User,
    onboarding_token: str,
) -> dict[str, Any]:
    draft = await _load_draft(onboarding_token)
    await _assert_manager_owns_draft(draft, manager)
    return _serialize_partner_onboarding_draft(draft)


async def download_partner_onboarding_document(
    *,
    manager: User,
    onboarding_token: str,
    doc_type: str,
) -> tuple[bytes, str, str]:
    draft = await _load_draft(onboarding_token)
    await _assert_manager_owns_draft(draft, manager)
    normalized_type = doc_type.strip().lower()
    if normalized_type not in {"pan", "aadhaar"}:
        raise PartnerOnboardingError("Unsupported document type.", "invalid_document_type", 400)

    payload = await get_partner_onboarding_document(onboarding_token, normalized_type)
    if not payload:
        raise PartnerOnboardingError("Document not uploaded yet.", "document_not_found", 404)

    content = base64.b64decode(payload["content_b64"])
    mime_type = str(payload.get("mime_type") or "application/octet-stream")
    file_name = str(payload.get("file_name") or f"{normalized_type}.pdf")
    return content, mime_type, file_name


async def download_partner_onboarding_profile_photo(
    *,
    manager: User,
    onboarding_token: str,
) -> tuple[bytes, str, str]:
    draft = await _load_draft(onboarding_token)
    await _assert_manager_owns_draft(draft, manager)
    payload = await get_partner_onboarding_profile_photo(onboarding_token)
    if not payload:
        raise PartnerOnboardingError("Profile photo not uploaded yet.", "profile_photo_not_found", 404)

    content = base64.b64decode(payload["content_b64"])
    mime_type = str(payload.get("mime_type") or "image/jpeg")
    file_name = str(payload.get("file_name") or "profile-photo.jpg")
    return content, mime_type, file_name


def _validate_submit_draft(draft: dict[str, Any]) -> None:
    if not draft.get("email_verified") or not draft.get("mobile_verified"):
        raise PartnerOnboardingError("Verify email and mobile first.", "contact_not_verified", 400)
    if not str(draft.get("first_name") or "").strip():
        raise PartnerOnboardingError("First name is required.", "name_required", 400)
    if not str(draft.get("last_name") or "").strip():
        raise PartnerOnboardingError("Last name is required.", "name_required", 400)
    pan = str(draft.get("pan") or "").strip().upper()
    if not pan or not _PAN_PATTERN.fullmatch(pan):
        raise PartnerOnboardingError("PAN is required.", "pan_required", 400)
    if not draft.get("pan_verified"):
        raise PartnerOnboardingError("Verify PAN before submitting.", "pan_not_verified", 400)
    if not draft.get("bank_verified"):
        raise PartnerOnboardingError("Verify bank account before submitting.", "bank_not_verified", 400)
    bank = draft.get("bank") or {}
    account_number = re.sub(r"\D", "", str(bank.get("account_number") or ""))
    ifsc = str(bank.get("ifsc") or "").strip().upper()
    if len(account_number) < 9 or not _IFSC_PATTERN.fullmatch(ifsc):
        raise PartnerOnboardingError("Bank details are required.", "bank_required", 400)
    address = draft.get("address") or {}
    if not str(address.get("line1") or "").strip() or len(str(address.get("pincode") or "")) != 6:
        raise PartnerOnboardingError("Registered address is required.", "address_required", 400)
    documents = draft.get("documents") or {}
    if not documents.get("pan_uploaded") or not documents.get("aadhaar_uploaded"):
        raise PartnerOnboardingError("Upload PAN and Aadhaar documents.", "documents_required", 400)
    profile_photo = draft.get("profile_photo") or {}
    if not profile_photo.get("uploaded"):
        raise PartnerOnboardingError("Upload a profile photo for the Zynd Mitra.", "profile_photo_required", 400)


async def _persist_onboarding_documents(
    db: AsyncSession,
    *,
    user: User,
    onboarding_token: str,
    ip: str | None,
) -> None:
    for doc_type, document_type in (("pan", DocumentType.pan), ("aadhaar", DocumentType.aadhaar)):
        payload = await get_partner_onboarding_document(onboarding_token, doc_type)
        if not payload:
            raise PartnerOnboardingError(
                f"Missing uploaded {doc_type} document.",
                "documents_required",
                400,
            )
        content = base64.b64decode(payload["content_b64"])
        await upload_user_document(
            db,
            user=user,
            doc_type=document_type,
            filename=payload.get("file_name") or f"{doc_type}.pdf",
            mime_type=payload.get("mime_type") or "application/pdf",
            content=content,
            ip=ip,
        )

    photo_payload = await get_partner_onboarding_profile_photo(onboarding_token)
    if photo_payload:
        photo_bytes = base64.b64decode(photo_payload["content_b64"])
        await upload_user_document(
            db,
            user=user,
            doc_type=DocumentType.profile_image,
            filename=photo_payload.get("file_name") or "profile-photo.jpg",
            mime_type=photo_payload.get("mime_type") or "image/jpeg",
            content=photo_bytes,
            ip=ip,
        )


async def submit_partner_onboarding(
    db: AsyncSession,
    *,
    manager: User,
    onboarding_token: str,
    ip: str | None,
) -> dict[str, Any]:
    await _assert_manager_can_onboard(db, manager)
    draft = await _load_draft(onboarding_token)
    if str(draft.get("manager_user_id")) != str(manager.id):
        raise PartnerOnboardingError("Invalid onboarding session.", "onboarding_invalid", 403)

    _validate_submit_draft(draft)
    email = draft["email"]
    mobile = draft["mobile"]
    await _assert_email_available(db, email)
    if mobile:
        await _assert_phone_available(db, mobile)

    now = utcnow()
    user = User(
        email=email,
        phone=mobile,
        first_name=str(draft["first_name"]).strip(),
        middle_name=str(draft.get("middle_name") or "").strip() or None,
        last_name=str(draft.get("last_name") or "").strip() or None,
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
        phone_verified_at=now if mobile else None,
        password_hash=None,
    )
    await assign_zynd_persona_client_id(
        db,
        user,
        role_code=ZYND_PERSONA_MITRA,
        first_name=user.first_name,
        last_name=user.last_name,
    )
    db.add(user)
    await db.flush()

    await assign_role_to_admin_user(
        db,
        user_id=user.id,
        role_key=DISTRIBUTOR_PARTNER_ROLE_KEY,
    )

    pan = str(draft.get("pan") or "").strip().upper()
    manager_branch = await get_distributor_branch_for_manager(db, manager_user_id=manager.id)
    profile_payload = {
        "bank": draft.get("bank"),
        "address": draft.get("address"),
        "documents": draft.get("documents"),
        "pan_verified_name": draft.get("pan_verified_name"),
    }
    partner = DistributorPartner(
        user_id=user.id,
        onboarded_by_user_id=manager.id,
        branch_id=manager_branch.id if manager_branch else None,
        pan_masked=_mask_pan(pan),
        profile_payload=profile_payload,
        status=DistributorPartnerStatus.pending_ho_review,
    )
    db.add(partner)

    db.add(
        AuditLog(
            user_id=manager.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "kind": "distributor_partner_onboarded",
                "partner_user_id": str(user.id),
                "partner_email": email,
            },
        )
    )
    await db.flush()

    await _persist_onboarding_documents(db, user=user, onboarding_token=onboarding_token, ip=ip)
    await delete_partner_onboarding_draft(onboarding_token)

    display_name = " ".join(
        part
        for part in [user.first_name, user.middle_name, user.last_name]
        if part and str(part).strip()
    ).strip()

    return {
        "partner_id": partner.id,
        "user_id": user.id,
        "email": user.email,
        "display_name": display_name or user.email,
        "status": partner.status.value,
    }


async def list_distributor_partners(
    db: AsyncSession,
    *,
    manager: User,
) -> list[dict[str, Any]]:
    from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id

    await _assert_manager_can_onboard(db, manager)
    result = await db.execute(
        select(DistributorPartner, User)
        .join(User, User.id == DistributorPartner.user_id)
        .where(DistributorPartner.onboarded_by_user_id == manager.id)
        .order_by(DistributorPartner.created_at.desc())
    )
    rows_raw = result.all()
    user_ids = [user.id for _, user in rows_raw]
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=user_ids)
    rows: list[dict[str, Any]] = []
    for partner, user in rows_raw:
        display_name = " ".join(
            part for part in [user.first_name, user.middle_name, user.last_name] if part
        ).strip()
        rows.append(
            _serialize_partner_list_item(
                partner=partner,
                user=user,
                profile_image_url=profile_images.get(user.id),
            )
        )
    return rows


async def get_distributor_partner_detail(
    db: AsyncSession,
    *,
    manager: User,
    reference: str,
) -> dict[str, Any]:
    from app.application.admin.user_admin_service import get_user_by_reference
    from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id

    await _assert_manager_can_onboard(db, manager)
    user = await get_user_by_reference(db, reference)
    if not user:
        raise PartnerOnboardingError("Zynd Mitra not found in this branch.", "partner_not_found", 404)

    result = await db.execute(
        select(DistributorPartner)
        .where(
            DistributorPartner.user_id == user.id,
            DistributorPartner.onboarded_by_user_id == manager.id,
        )
        .limit(1)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise PartnerOnboardingError("Zynd Mitra not found in this branch.", "partner_not_found", 404)

    branch_name = "Your branch"
    if partner.branch_id:
        branch = await get_distributor_branch_by_id(db, partner.branch_id)
        if branch:
            branch_name = branch.name
    else:
        manager_branch = await get_distributor_branch_for_manager(db, manager_user_id=manager.id)
        if manager_branch:
            branch_name = manager_branch.name

    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=[user.id])
    return _serialize_partner_detail(
        partner=partner,
        user=user,
        branch_name=branch_name,
        profile_image_url=profile_images.get(user.id),
    )
