from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.distributor.distributor_client_link_service import (
    DistributorClientBookError,
    assert_actor_can_access_client,
)
from app.application.kyc.bank_verification_service import (
    get_bank_preverify_status,
    verify_bank_hybrid,
)
from app.application.kyc.journey_gate_service import (
    require_digilocker_or_kra_skip,
    require_pan_verified,
    require_phase1_complete,
    require_phase2_complete,
    requires_digilocker,
)
from app.application.kyc.journey_state_service import (
    get_or_create_journey,
    get_or_create_status,
    journey_to_bootstrap_dict,
    resolve_active_step_index,
    save_journey_state,
)
from app.application.kyc.kyc_form_service import submit_kyc_form
from app.application.investor.investor_nominee_sync_service import sync_nominees_from_kyc_draft
from app.application.documents.client_id_service import assign_client_id, is_placeholder_client_id
from app.application.kyc.pan_verification_service import confirm_pan_names, verify_pan
from app.infrastructure.persistence.models import User, UserRole
from app.infrastructure.kyc.fp_clients import ensure_kyc_tokens


async def _load_investor_client(db: AsyncSession, client_user_id: UUID) -> User:
    client_user = await db.get(User, client_user_id)
    if client_user is None or client_user.role != UserRole.user:
        raise DistributorClientBookError("Client not found.", "client_not_found", 404)
    return client_user


async def verify_distributor_client_kyc_pan(
    db: AsyncSession,
    *,
    actor: User,
    client_user_id: UUID,
    pan_number: str,
) -> dict:
    client_user = await _load_investor_client(db, client_user_id)
    await assert_actor_can_access_client(db, actor=actor, client_user=client_user)
    return await verify_pan(db, user=client_user, pan_number=pan_number)


async def confirm_distributor_client_kyc_pan_names(
    db: AsyncSession,
    *,
    actor: User,
    client_user_id: UUID,
    first_name: str,
    middle_name: str,
    last_name: str,
) -> dict:
    client_user = await _load_investor_client(db, client_user_id)
    await assert_actor_can_access_client(db, actor=actor, client_user=client_user)
    return await confirm_pan_names(
        db,
        user=client_user,
        first_name=first_name,
        middle_name=middle_name,
        last_name=last_name,
    )


async def verify_distributor_client_kyc_bank_hybrid(
    db: AsyncSession,
    *,
    actor: User,
    client_user_id: UUID,
    account_number: str,
    account_type: str,
    ifsc_code: str,
) -> dict:
    client_user = await _load_investor_client(db, client_user_id)
    await assert_actor_can_access_client(db, actor=actor, client_user=client_user)
    await ensure_kyc_tokens()
    return await verify_bank_hybrid(
        db,
        user=client_user,
        account_number=account_number,
        account_type=account_type,
        ifsc_code=ifsc_code,
        skip_phase1_gate=True,
    )


async def get_distributor_client_kyc_bootstrap(
    db: AsyncSession,
    *,
    actor: User,
    client_user_id: UUID,
) -> dict:
    client_user = await _load_investor_client(db, client_user_id)
    await assert_actor_can_access_client(db, actor=actor, client_user=client_user)
    if is_placeholder_client_id(client_user.client_id):
        await assign_client_id(db, client_user)
        await db.flush()
    journey = await get_or_create_journey(db, client_user.id)
    status = await get_or_create_status(db, client_user.id)
    payload = journey_to_bootstrap_dict(journey, status)
    payload["clientId"] = client_user.client_id
    return payload


async def get_distributor_client_kyc_bank_preverify_status(
    db: AsyncSession,
    *,
    actor: User,
    client_user_id: UUID,
    preverify_id: str,
) -> dict:
    client_user = await _load_investor_client(db, client_user_id)
    await assert_actor_can_access_client(db, actor=actor, client_user=client_user)
    return await get_bank_preverify_status(db, user_id=client_user.id, preverify_id=preverify_id)


async def save_distributor_client_kyc_journey_state(
    db: AsyncSession,
    *,
    actor: User,
    client_user_id: UUID,
    pan_draft_json: dict | None = None,
    contact_draft_json: dict | None = None,
    personal_draft_json: dict | None = None,
    nominee_draft_json: list[dict] | None = None,
    bank_draft_json: dict | None = None,
    signature_draft_json: dict | None = None,
    geolocation_json: dict | None = None,
    last_completed_step: str | None = None,
    middle_name: str | None = None,
) -> dict:
    client_user = await _load_investor_client(db, client_user_id)
    await assert_actor_can_access_client(db, actor=actor, client_user=client_user)
    journey = await get_or_create_journey(db, client_user.id)
    require_pan_verified(journey)

    payload: dict = {}
    if pan_draft_json is not None:
        payload["panDraftJson"] = pan_draft_json
    elif middle_name is not None and journey.pan_draft_json:
        pan_draft = dict(journey.pan_draft_json)
        pan_draft["middleName"] = middle_name.strip()
        payload["panDraftJson"] = pan_draft

    if contact_draft_json is not None:
        if requires_digilocker(journey) and journey.external_kyc_status != "returned_success":
            payload["externalKycStatus"] = "returned_success"
        else:
            require_digilocker_or_kra_skip(journey)
        payload["contactDraftJson"] = contact_draft_json

    if personal_draft_json is not None:
        if contact_draft_json is None and "externalKycStatus" not in payload:
            require_digilocker_or_kra_skip(journey)
        payload["personalDraftJson"] = personal_draft_json

    if nominee_draft_json is not None:
        require_phase1_complete(journey)
        payload["nomineeDraftJson"] = nominee_draft_json

    if bank_draft_json is not None:
        require_phase1_complete(journey)
        payload["bankDraftJson"] = bank_draft_json

    if signature_draft_json is not None:
        require_phase2_complete(journey)
        payload["signatureDraftJson"] = signature_draft_json

    if geolocation_json is not None:
        require_phase2_complete(journey)
        payload["geolocationJson"] = geolocation_json

    if last_completed_step is not None:
        payload["lastCompletedStep"] = last_completed_step

    journey, _ = await save_journey_state(db, user=client_user, payload=payload)
    if nominee_draft_json is not None:
        await sync_nominees_from_kyc_draft(db, user=client_user, journey=journey)

    return {
        "lastCompletedStep": journey.last_completed_step,
        "activeStepIndex": resolve_active_step_index(journey),
    }


async def submit_distributor_client_kyc(
    db: AsyncSession,
    *,
    actor: User,
    client_user_id: UUID,
    latitude: float | None = None,
    longitude: float | None = None,
    accuracy_meters: float | None = None,
    client_ip: str | None = None,
) -> dict:
    client_user = await _load_investor_client(db, client_user_id)
    await assert_actor_can_access_client(db, actor=actor, client_user=client_user)
    return await submit_kyc_form(
        db,
        user=client_user,
        latitude=latitude,
        longitude=longitude,
        accuracy_meters=accuracy_meters,
        client_ip=client_ip,
    )
