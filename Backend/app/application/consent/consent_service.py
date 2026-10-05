from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.consent.errors import ConsentError
from app.application.shared.datetime_utils import utcnow
from app.domain.consent import keys as consent_keys
from app.infrastructure.persistence.consent_models import (
    ConsentDefinition,
    ConsentReacceptPolicy,
    ConsentVersion,
    ConsentVersionStatus,
    UserConsentAction,
    UserConsentRecord,
)
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.repositories.audit_repository import SqlAlchemyAuditRepository


class ConsentAcceptContext:
    def __init__(
        self,
        *,
        source: str,
        ip: str | None = None,
        user_agent: str | None = None,
        device_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.source = source
        self.ip = ip
        self.user_agent = user_agent
        self.device_id = device_id
        self.metadata = metadata


async def get_definition_by_key(db: AsyncSession, definition_key: str) -> ConsentDefinition | None:
    result = await db.execute(
        select(ConsentDefinition).where(
            ConsentDefinition.key == definition_key,
            ConsentDefinition.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def get_published_version(
    db: AsyncSession,
    *,
    definition_id: UUID,
) -> ConsentVersion | None:
    result = await db.execute(
        select(ConsentVersion)
        .where(
            ConsentVersion.consent_definition_id == definition_id,
            ConsentVersion.status == ConsentVersionStatus.published,
        )
        .order_by(ConsentVersion.version_number.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_published_version_by_key(
    db: AsyncSession,
    definition_key: str,
) -> tuple[ConsentDefinition, ConsentVersion] | None:
    definition = await get_definition_by_key(db, definition_key)
    if not definition:
        return None
    version = await get_published_version(db, definition_id=definition.id)
    if not version:
        return None
    return definition, version


async def _latest_user_records(
    db: AsyncSession,
    *,
    user_id: UUID,
    consent_definition_id: UUID,
    limit: int = 20,
) -> list[UserConsentRecord]:
    result = await db.execute(
        select(UserConsentRecord)
        .where(
            UserConsentRecord.user_id == user_id,
            UserConsentRecord.consent_definition_id == consent_definition_id,
        )
        .order_by(UserConsentRecord.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def user_has_active_acceptance(
    db: AsyncSession,
    *,
    user_id: UUID,
    definition_key: str,
) -> bool:
    pair = await get_published_version_by_key(db, definition_key)
    if not pair:
        return True
    definition, published = pair
    records = await _latest_user_records(db, user_id=user_id, consent_definition_id=definition.id)
    if not records:
        return False
    latest = records[0]
    if latest.action == UserConsentAction.revoked:
        return False
    if latest.action != UserConsentAction.accepted:
        return False
    if latest.consent_version_id == published.id:
        return True
    if definition.reaccept_policy == ConsentReacceptPolicy.never:
        return True
    return False


async def user_revocable_consent_active(
    db: AsyncSession,
    *,
    user_id: UUID,
    definition_key: str,
) -> bool:
    definition = await get_definition_by_key(db, definition_key)
    if not definition:
        return False
    records = await _latest_user_records(db, user_id=user_id, consent_definition_id=definition.id, limit=1)
    if not records:
        return False
    return records[0].action == UserConsentAction.accepted


async def get_required_consents(
    db: AsyncSession,
    *,
    user_id: UUID,
    context: str,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(ConsentDefinition).where(ConsentDefinition.is_active.is_(True)).order_by(ConsentDefinition.key)
    )
    definitions = list(result.scalars().all())
    required: list[dict[str, Any]] = []
    for definition in definitions:
        if context in {"signup", "login"} and definition.key != consent_keys.PLATFORM_SIGNUP_LEGAL:
            continue
        if context == "login" and definition.reaccept_policy != ConsentReacceptPolicy.on_new_version:
            continue
        if context == "kyc":
            continue
        if definition.channel.value == "distributor" and context in {"signup", "login"}:
            continue
        if await user_has_active_acceptance(db, user_id=user_id, definition_key=definition.key):
            continue
        published = await get_published_version(db, definition_id=definition.id)
        if not published:
            continue
        required.append(_serialize_definition_version(definition, published))
    return required


async def record_acceptance(
    db: AsyncSession,
    *,
    user: User,
    definition_key: str,
    consent_version_id: UUID | None = None,
    context: ConsentAcceptContext,
) -> UserConsentRecord:
    pair = await get_published_version_by_key(db, definition_key)
    if not pair:
        raise ConsentError("Consent is not available.", "consent_not_found", 404)
    definition, published = pair
    version_id = consent_version_id or published.id
    if version_id != published.id:
        raise ConsentError(
            "Accept the current published version of this consent.",
            "consent_version_mismatch",
            400,
        )

    record = UserConsentRecord(
        user_id=user.id,
        consent_definition_id=definition.id,
        consent_version_id=version_id,
        action=UserConsentAction.accepted,
        source=context.source,
        ip_address=context.ip,
        user_agent=context.user_agent,
        device_id=context.device_id,
        metadata_=context.metadata,
    )
    db.add(record)
    await SqlAlchemyAuditRepository(db).append(
        event_type=AuditEventType.consent_accepted,
        user_id=user.id,
        ip=context.ip,
        metadata={
            "consent_key": definition.key,
            "consent_version_id": str(version_id),
            "source": context.source,
        },
    )
    await db.flush()
    return record


async def record_revocation(
    db: AsyncSession,
    *,
    user: User,
    definition_key: str,
    context: ConsentAcceptContext,
) -> UserConsentRecord:
    pair = await get_published_version_by_key(db, definition_key)
    if not pair:
        raise ConsentError("Consent is not available.", "consent_not_found", 404)
    definition, published = pair
    record = UserConsentRecord(
        user_id=user.id,
        consent_definition_id=definition.id,
        consent_version_id=published.id,
        action=UserConsentAction.revoked,
        source=context.source,
        ip_address=context.ip,
        user_agent=context.user_agent,
        device_id=context.device_id,
        metadata_=context.metadata,
    )
    db.add(record)
    await SqlAlchemyAuditRepository(db).append(
        event_type=AuditEventType.consent_revoked,
        user_id=user.id,
        ip=context.ip,
        metadata={"consent_key": definition.key, "source": context.source},
    )
    await db.flush()
    return record


async def record_acceptances_for_keys(
    db: AsyncSession,
    *,
    user: User,
    consent_keys_list: list[str],
    context: ConsentAcceptContext,
) -> list[UserConsentRecord]:
    records: list[UserConsentRecord] = []
    for key in consent_keys_list:
        records.append(
            await record_acceptance(db, user=user, definition_key=key, context=context)
        )
    return records


async def list_user_consent_history(
    db: AsyncSession,
    *,
    user_id: UUID,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(UserConsentRecord)
        .where(UserConsentRecord.user_id == user_id)
        .options(
            selectinload(UserConsentRecord.definition),
            selectinload(UserConsentRecord.version),
        )
        .order_by(UserConsentRecord.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = list(result.scalars().all())
    return [_serialize_user_record(row) for row in rows]


async def aggregate_acceptance_stats(
    db: AsyncSession,
    *,
    definition_key: str | None = None,
) -> list[dict[str, Any]]:
    version_query = (
        select(ConsentDefinition, ConsentVersion)
        .join(ConsentVersion, ConsentVersion.consent_definition_id == ConsentDefinition.id)
        .where(ConsentVersion.status == ConsentVersionStatus.published)
        .order_by(ConsentDefinition.key)
    )
    if definition_key:
        version_query = version_query.where(ConsentDefinition.key == definition_key)
    result = await db.execute(version_query)
    stats: list[dict[str, Any]] = []
    for definition, version in result.all():
        count = await db.scalar(
            select(func.count(UserConsentRecord.id)).where(
                UserConsentRecord.consent_version_id == version.id,
                UserConsentRecord.action == UserConsentAction.accepted,
            )
        )
        stats.append(
            {
                "consent_key": definition.key,
                "title": definition.title,
                "version_label": version.version_label,
                "consent_version_id": version.id,
                "acceptance_count": int(count or 0),
            }
        )
    return stats


def _serialize_definition_version(definition: ConsentDefinition, version: ConsentVersion) -> dict[str, Any]:
    return {
        "consent_key": definition.key,
        "title": definition.title,
        "description": definition.description,
        "acceptance_mode": definition.acceptance_mode.value,
        "reaccept_policy": definition.reaccept_policy.value,
        "consent_version_id": version.id,
        "version_label": version.version_label,
        "summary_text": version.summary_text,
        "body_markdown": version.body_markdown,
        "document_url": version.document_url,
    }


def _serialize_user_record(row: UserConsentRecord) -> dict[str, Any]:
    return {
        "id": row.id,
        "consent_key": row.definition.key if row.definition else None,
        "consent_title": row.definition.title if row.definition else None,
        "version_label": row.version.version_label if row.version else None,
        "consent_version_id": row.consent_version_id,
        "action": row.action.value,
        "source": row.source,
        "ip_address": row.ip_address,
        "metadata": row.metadata_,
        "created_at": row.created_at,
    }


async def list_definitions_admin(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(ConsentDefinition)
        .options(selectinload(ConsentDefinition.versions))
        .order_by(ConsentDefinition.key)
    )
    items: list[dict[str, Any]] = []
    for definition in result.scalars().all():
        published = next(
            (v for v in definition.versions if v.status == ConsentVersionStatus.published),
            None,
        )
        items.append(
            {
                "id": definition.id,
                "key": definition.key,
                "title": definition.title,
                "description": definition.description,
                "channel": definition.channel.value,
                "acceptance_mode": definition.acceptance_mode.value,
                "reaccept_policy": definition.reaccept_policy.value,
                "is_active": definition.is_active,
                "published_version": (
                    {
                        "id": published.id,
                        "version_label": published.version_label,
                        "summary_text": published.summary_text,
                        "document_url": published.document_url,
                        "published_at": published.published_at,
                    }
                    if published
                    else None
                ),
                "versions": [
                    {
                        "id": v.id,
                        "version_label": v.version_label,
                        "version_number": v.version_number,
                        "status": v.status.value,
                        "summary_text": v.summary_text,
                        "document_url": v.document_url,
                        "published_at": v.published_at,
                    }
                    for v in sorted(definition.versions, key=lambda x: x.version_number, reverse=True)
                ],
            }
        )
    return items


async def create_draft_version(
    db: AsyncSession,
    *,
    definition_key: str,
    version_label: str,
    summary_text: str | None,
    body_markdown: str | None,
    document_url: str | None,
) -> ConsentVersion:
    definition = await get_definition_by_key(db, definition_key)
    if not definition:
        raise ConsentError("Consent definition not found.", "consent_not_found", 404)
    max_num = await db.scalar(
        select(func.max(ConsentVersion.version_number)).where(
            ConsentVersion.consent_definition_id == definition.id
        )
    )
    version = ConsentVersion(
        consent_definition_id=definition.id,
        version_label=version_label.strip(),
        version_number=int(max_num or 0) + 1,
        status=ConsentVersionStatus.draft,
        summary_text=summary_text,
        body_markdown=body_markdown,
        document_url=document_url,
    )
    db.add(version)
    await db.flush()
    return version


async def publish_version_direct(
    db: AsyncSession,
    *,
    version_id: UUID,
    publisher: User,
    ip: str | None = None,
) -> ConsentVersion:
    version = await db.get(ConsentVersion, version_id)
    if not version:
        raise ConsentError("Consent version not found.", "consent_version_not_found", 404)
    if version.status != ConsentVersionStatus.draft:
        raise ConsentError("Only draft versions can be published.", "consent_version_not_draft", 400)

    result = await db.execute(
        select(ConsentVersion).where(
            ConsentVersion.consent_definition_id == version.consent_definition_id,
            ConsentVersion.status == ConsentVersionStatus.published,
        )
    )
    for existing in result.scalars().all():
        existing.status = ConsentVersionStatus.archived

    version.status = ConsentVersionStatus.published
    version.published_at = utcnow()
    version.published_by_user_id = publisher.id
    await SqlAlchemyAuditRepository(db).append(
        event_type=AuditEventType.consent_version_published,
        user_id=publisher.id,
        ip=ip,
        metadata={"consent_version_id": str(version.id), "version_label": version.version_label},
    )
    await db.flush()
    return version
