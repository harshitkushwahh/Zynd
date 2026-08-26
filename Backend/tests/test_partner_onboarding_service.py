from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    ensure_rbac_seed,
    set_admin_user_roles,
)
from app.application.distributor.partner_onboarding_service import (
    PartnerOnboardingError,
    get_partner_onboarding_draft_snapshot,
    list_distributor_partners,
    send_partner_onboarding_mobile_otp,
    start_partner_onboarding,
    submit_partner_onboarding,
    update_partner_onboarding_draft_fields,
    upload_partner_onboarding_document,
    upload_partner_onboarding_profile_photo,
    verify_partner_onboarding_email,
    verify_partner_onboarding_mobile,
)
from app.infrastructure.persistence.partner_onboarding_draft_store import get_partner_onboarding_draft
from app.application.distributor.partner_verification_service import (
    verify_partner_onboarding_bank,
    verify_partner_onboarding_bank_manual,
    verify_partner_onboarding_pan,
)
from app.application.kyc.bank_verification_core import HybridBankVerificationOutcome
from app.core.config import get_settings
from app.infrastructure.persistence.distributor_partner_models import DistributorPartner
from app.infrastructure.persistence.distributor_branch_models import DistributorBranch, DistributorBranchStatus
from app.infrastructure.persistence.models import User, UserRole, UserStatus


def _png_bytes(width: int = 256, height: int = 256) -> bytes:
    try:
        from io import BytesIO

        from PIL import Image

        image = Image.new("RGB", (width, height), color=(120, 160, 200))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()
    except ImportError:
        return (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
            b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        )


async def _assign_manager_branch(db: AsyncSession, manager: User) -> DistributorBranch:
    branch = DistributorBranch(
        id=f"br-{uuid.uuid4().hex[:8]}",
        branch_code=f"T{uuid.uuid4().hex[:6].upper()}",
        name="Test Branch",
        city="Mumbai",
        state_code="MH",
        state_name="Maharashtra",
        status=DistributorBranchStatus.active,
        manager_user_id=manager.id,
    )
    db.add(branch)
    await db.flush()
    return branch


async def _create_manager(
    db: AsyncSession,
    email: str | None = None,
    *,
    assign_branch: bool = True,
) -> User:
    manager_email = email or f"manager-onboard-{uuid.uuid4().hex[:8]}@example.com"
    await ensure_rbac_seed(db)
    manager = User(
        email=manager_email,
        password_hash="hash",
        first_name="Branch",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db.add(manager)
    await db.flush()
    await set_admin_user_roles(db, user_id=manager.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    if assign_branch:
        await _assign_manager_branch(db, manager)
    return manager


@pytest.mark.asyncio
async def test_partner_onboarding_submits_for_ho_review(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "123456")
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv("DOCUMENT_SCAN_DISPATCH_MODE", "sync")
    get_settings.cache_clear()

    async def stub_pan(_pan: str) -> dict[str, str]:
        return {"fullName": "New Mitra", "dateOfBirth": "1990-01-01", "panCategory": "individual"}

    async def stub_hybrid_bank_verification(**kwargs) -> HybridBankVerificationOutcome:
        _ = kwargs
        return HybridBankVerificationOutcome(
            poa_result={"id": "poa_1", "bank_accounts": [{"status": "verified"}]},
            preverify_id="poa_1",
            bank_verified=True,
            pan_verified=True,
            readiness_verified=False,
            requires_manual=False,
            requires_proof_upload=False,
            failure=None,
            kyckart_holder_name="New Mitra",
            kyckart_lookup_error=None,
            pan_holder_name="New Mitra",
            poa_pan_status={"status": "verified"},
            poa_bank_status={"status": "verified"},
            poa_readiness_status={"status": "failed"},
            bank_name="HDFC Bank",
            branch="Mumbai",
            poa_account_type="savings",
            account_number="123456789012",
            ifsc_code="HDFC0001234",
            account_type_label="Savings",
        )

    monkeypatch.setattr(
        "app.application.distributor.partner_verification_service.kyckart_pan_to_name_dob",
        stub_pan,
    )
    monkeypatch.setattr(
        "app.application.distributor.partner_verification_service.run_hybrid_bank_verification",
        stub_hybrid_bank_verification,
    )

    emails: list[str] = []

    async def capture_email(*, to_email: str, subject: str, body: str) -> bool:
        emails.append(subject)
        return True

    monkeypatch.setattr(
        "app.application.distributor.partner_onboarding_notifications.send_security_email",
        capture_email,
    )

    manager = await _create_manager(db_session)
    mitra_email = f"new.mitra.{uuid.uuid4().hex[:8]}@example.com"
    started = await start_partner_onboarding(
        db_session,
        manager=manager,
        email=mitra_email,
        ip="127.0.0.1",
    )
    token = started["onboarding_token"]
    await verify_partner_onboarding_email(onboarding_token=token, otp="123456")
    mobile = f"91{uuid.uuid4().int % 10_000_000_00:08d}"[-10:]
    await send_partner_onboarding_mobile_otp(
        db_session,
        manager=manager,
        onboarding_token=token,
        mobile=mobile,
        ip="127.0.0.1",
    )
    await verify_partner_onboarding_mobile(onboarding_token=token, otp="123456")
    await verify_partner_onboarding_pan(onboarding_token=token, pan="ABCDE1234F")
    await verify_partner_onboarding_bank(
        onboarding_token=token,
        account_number="123456789012",
        account_type="Savings",
        ifsc="HDFC0001234",
    )
    await update_partner_onboarding_draft_fields(
        onboarding_token=token,
        payload={
            "first_name": "New",
            "last_name": "Mitra",
            "address": {
                "line1": "221B Baker Street",
                "line2": "",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001",
                "country": "India",
            },
        },
    )
    await upload_partner_onboarding_document(
        db_session,
        manager=manager,
        onboarding_token=token,
        doc_type="pan",
        filename="pan.pdf",
        mime_type="application/pdf",
        content=b"%PDF-1.4 test",
    )
    await upload_partner_onboarding_document(
        db_session,
        manager=manager,
        onboarding_token=token,
        doc_type="aadhaar",
        filename="aadhaar.pdf",
        mime_type="application/pdf",
        content=b"%PDF-1.4 test",
    )
    await upload_partner_onboarding_profile_photo(
        db_session,
        manager=manager,
        onboarding_token=token,
        filename="avatar.png",
        mime_type="image/png",
        content=_png_bytes(),
    )

    result = await submit_partner_onboarding(
        db_session,
        manager=manager,
        onboarding_token=token,
        ip="127.0.0.1",
    )
    await db_session.commit()

    user = (
        await db_session.execute(select(User).where(User.email == mitra_email))
    ).scalar_one()
    assert user.password_hash is None
    assert result["status"] == "pending_ho_review"
    assert emails == []

    partners = await list_distributor_partners(db_session, manager=manager)
    assert len(partners) == 1
    assert partners[0]["status"] == "Pending review"

    partner_row = (
        await db_session.execute(select(DistributorPartner).where(DistributorPartner.user_id == user.id))
    ).scalar_one()
    assert partner_row.onboarded_by_user_id == manager.id

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_partner_onboarding_rejects_non_manager(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    user = User(
        email="field@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=user.id, role_keys=["mitra"])

    with pytest.raises(PartnerOnboardingError) as exc_info:
        await start_partner_onboarding(
            db_session,
            manager=user,
            email="another@example.com",
            ip=None,
        )
    assert exc_info.value.code == "manager_required"


@pytest.mark.asyncio
async def test_partner_onboarding_requires_branch_assignment(db_session: AsyncSession) -> None:
    manager = await _create_manager(db_session, assign_branch=False)

    with pytest.raises(PartnerOnboardingError) as exc_info:
        await start_partner_onboarding(
            db_session,
            manager=manager,
            email="unassigned.branch@example.com",
            ip="127.0.0.1",
        )
    assert exc_info.value.code == "branch_assignment_required"


@pytest.mark.asyncio
async def test_partner_onboarding_manual_bank_verify(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "123456")
    get_settings.cache_clear()

    async def stub_pan(_pan: str) -> dict[str, str]:
        return {"fullName": "New Mitra", "dateOfBirth": "1990-01-01", "panCategory": "individual"}

    async def stub_ifsc(ifsc: str) -> tuple[str, str, str]:
        return ifsc, "HDFC Bank", "Mumbai"

    monkeypatch.setattr(
        "app.application.distributor.partner_verification_service.kyckart_pan_to_name_dob",
        stub_pan,
    )
    monkeypatch.setattr(
        "app.application.distributor.partner_verification_service.resolve_ifsc_details",
        stub_ifsc,
    )

    manager = await _create_manager(db_session, email="manager-manual-bank@example.com")
    started = await start_partner_onboarding(
        db_session,
        manager=manager,
        email="manual.bank@example.com",
        ip="127.0.0.1",
    )
    token = started["onboarding_token"]
    await verify_partner_onboarding_email(onboarding_token=token, otp="123456")
    await send_partner_onboarding_mobile_otp(
        db_session,
        manager=manager,
        onboarding_token=token,
        mobile="9123456780",
        ip="127.0.0.1",
    )
    await verify_partner_onboarding_mobile(onboarding_token=token, otp="123456")
    await verify_partner_onboarding_pan(onboarding_token=token, pan="ABCDE1234G")

    result = await verify_partner_onboarding_bank_manual(
        onboarding_token=token,
        account_holder_name="New Mitra",
        account_number="123456789012",
        confirm_account_number="123456789012",
        account_type="Savings",
        ifsc="HDFC0001234",
        bank_name="HDFC Bank",
        branch_name="Mumbai Main",
    )

    assert result["verified"] is True
    assert result["verification_mode"] == "manual"
    get_settings.cache_clear()


async def _verified_onboarding_token(
    db_session: AsyncSession,
    *,
    manager: User,
    email: str,
    mobile: str,
) -> str:
    started = await start_partner_onboarding(
        db_session,
        manager=manager,
        email=email,
        ip="127.0.0.1",
    )
    token = started["onboarding_token"]
    await verify_partner_onboarding_email(onboarding_token=token, otp="123456")
    await send_partner_onboarding_mobile_otp(
        db_session,
        manager=manager,
        onboarding_token=token,
        mobile=mobile,
        ip="127.0.0.1",
    )
    await verify_partner_onboarding_mobile(onboarding_token=token, otp="123456")
    await update_partner_onboarding_draft_fields(
        onboarding_token=token,
        payload={
            "first_name": "New",
            "middle_name": "Zynd",
            "last_name": "Mitra",
        },
    )
    return token


@pytest.mark.asyncio
async def test_partner_onboarding_document_patch_preserves_upload_flags(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "123456")
    get_settings.cache_clear()

    manager = await _create_manager(db_session)
    token = await _verified_onboarding_token(
        db_session,
        manager=manager,
        email=f"docs.patch.{uuid.uuid4().hex[:8]}@example.com",
        mobile=f"91{uuid.uuid4().int % 10_000_000_00:08d}"[-10:],
    )

    pan_result = await upload_partner_onboarding_document(
        db_session,
        manager=manager,
        onboarding_token=token,
        doc_type="pan",
        filename="ignored.pdf",
        mime_type="application/pdf",
        content=b"%PDF-1.4 test",
    )
    assert pan_result["file_name"].endswith("-pan.pdf")

    await update_partner_onboarding_draft_fields(
        onboarding_token=token,
        payload={
            "documents": {
                "pan_file_name": pan_result["file_name"],
                "aadhaar_file_name": None,
            },
        },
    )

    draft = await get_partner_onboarding_draft(token)
    assert draft is not None
    assert draft["documents"]["pan_uploaded"] is True
    assert draft["documents"]["pan_file_name"] == pan_result["file_name"]

    snapshot = await get_partner_onboarding_draft_snapshot(
        manager=manager,
        onboarding_token=token,
    )
    assert snapshot["documents"]["pan_uploaded"] is True
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_partner_onboarding_upload_uses_generated_filenames(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "123456")
    get_settings.cache_clear()

    manager = await _create_manager(db_session)
    mobile = f"91{uuid.uuid4().int % 10_000_000_00:08d}"[-10:]
    token = await _verified_onboarding_token(
        db_session,
        manager=manager,
        email=f"names.{uuid.uuid4().hex[:8]}@example.com",
        mobile=mobile,
    )

    pan_result = await upload_partner_onboarding_document(
        db_session,
        manager=manager,
        onboarding_token=token,
        doc_type="pan",
        filename="random-hash.pdf",
        mime_type="application/pdf",
        content=b"%PDF-1.4 test",
    )
    aadhaar_result = await upload_partner_onboarding_document(
        db_session,
        manager=manager,
        onboarding_token=token,
        doc_type="aadhaar",
        filename="another-random.pdf",
        mime_type="application/pdf",
        content=b"%PDF-1.4 test",
    )
    photo_result = await upload_partner_onboarding_profile_photo(
        db_session,
        manager=manager,
        onboarding_token=token,
        filename="avatar.png",
        mime_type="image/png",
        content=_png_bytes(),
    )

    mobile_suffix = mobile[-4:]
    assert pan_result["file_name"] == f"new-zynd-mitra-{mobile_suffix}-pan.pdf"
    assert aadhaar_result["file_name"] == f"new-zynd-mitra-{mobile_suffix}-aadhaar.pdf"
    assert photo_result["file_name"] == f"new-zynd-mitra-{mobile_suffix}-profile.jpg"
    get_settings.cache_clear()
