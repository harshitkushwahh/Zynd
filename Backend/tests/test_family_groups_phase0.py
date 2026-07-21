from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.group_service import (
    archive_family_group,
    create_family_group,
    get_family_group_for_user,
    list_family_groups_for_user,
    update_family_group,
)
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupMemberRole,
    FamilyGroupStatus,
)
from app.infrastructure.persistence.models import User, UserRole, UserStatus


async def _create_user(db_session: AsyncSession, *, prefix: str = "family") -> User:
    user = User(
        email=f"{prefix}-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
        first_name="Test",
        last_name="User",
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_create_family_group_adds_head_member(db_session: AsyncSession) -> None:
    user = await _create_user(db_session)

    payload = await create_family_group(
        db_session,
        user=user,
        title="Sharma Family",
        description="Primary household",
        tag="Primary",
    )

    assert payload["title"] == "Sharma Family"
    assert payload["my_role"] == FamilyGroupMemberRole.head.value
    assert payload["member_count"] == 1
    assert payload["status"] == FamilyGroupStatus.active.value


@pytest.mark.asyncio
async def test_create_family_group_enforces_five_group_limit(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, prefix="limit")

    for index in range(5):
        await create_family_group(
            db_session,
            user=user,
            title=f"Group {index + 1}",
        )

    with pytest.raises(FamilyGroupError) as exc_info:
        await create_family_group(
            db_session,
            user=user,
            title="Group 6",
        )

    assert exc_info.value.code == "group_limit_reached"
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_only_head_can_update_group(db_session: AsyncSession) -> None:
    head = await _create_user(db_session, prefix="head")
    other = await _create_user(db_session, prefix="other")

    created = await create_family_group(db_session, user=head, title="Family One")
    group_id = created["id"]

    with pytest.raises(FamilyGroupError) as exc_info:
        await update_family_group(
            db_session,
            group_id=group_id,
            user=other,
            title="Renamed",
        )

    assert exc_info.value.code == "forbidden"
    assert exc_info.value.status_code == 403

    updated = await update_family_group(
        db_session,
        group_id=group_id,
        user=head,
        title="Renamed Family",
        description="Updated description",
    )
    assert updated["title"] == "Renamed Family"
    assert updated["description"] == "Updated description"


@pytest.mark.asyncio
async def test_archive_family_group_marks_group_archived(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, prefix="archive")

    created = await create_family_group(db_session, user=user, title="Temporary Group")
    group_id = created["id"]

    archived = await archive_family_group(
        db_session,
        group_id=group_id,
        user=user,
    )

    assert archived["status"] == FamilyGroupStatus.archived.value
    assert archived["archived_at"] is not None

    groups = await list_family_groups_for_user(db_session, user_id=user.id)
    assert groups == []

    with pytest.raises(FamilyGroupError) as exc_info:
        await get_family_group_for_user(
            db_session,
            group_id=group_id,
            user_id=user.id,
        )

    assert exc_info.value.code == "group_not_found"


@pytest.mark.asyncio
async def test_list_family_groups_returns_only_active_memberships(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, prefix="list")

    first = await create_family_group(db_session, user=user, title="Alpha")
    second = await create_family_group(db_session, user=user, title="Beta")

    groups = await list_family_groups_for_user(db_session, user_id=user.id)
    titles = {group["title"] for group in groups}

    assert titles == {"Alpha", "Beta"}
    assert len(groups) == 2
    assert all(group["my_role"] == FamilyGroupMemberRole.head.value for group in groups)
    assert {group["id"] for group in groups} == {first["id"], second["id"]}
