from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.user_admin_service import (
    _kyc_compliant_user_ids,
    get_user_by_reference,
)
from app.application.distributor.distributor_client_link_service import (
    DistributorClientBookError,
    assert_actor_can_access_client,
    list_book_client_user_ids_for_actor,
)
from app.application.mf.invest_cached_read_service import cached_search_invest_funds
from app.application.mf.mf_cart_service import upsert_cart_item
from app.application.mf.mf_order_errors import MfOrderError
from app.core.config import get_settings
from app.infrastructure.persistence.mf_transaction_models import MfCartInvestmentType
from app.infrastructure.persistence.mf_models import Product, ProductDisplayContent
from app.infrastructure.persistence.mitra_txn_recommendation_models import (
    MITRA_TXN_RECOMMENDATION_MAX_ITEMS,
    MitraTxnInvestmentType,
    MitraTxnPaymentMethod,
    MitraTxnRecommendation,
    MitraTxnRecommendationItem,
    MitraTxnRecommendationStatus,
)
from app.infrastructure.persistence.models import User, UserRole

RECOMMENDATION_TTL_HOURS = 24


def _mask_email(email: str) -> str:
    local, separator, domain = email.partition("@")
    if not separator or not domain:
        return "***"
    if len(local) <= 1:
        return f"{local}***@{domain}" if local else f"***@{domain}"
    return f"{local[0]}***@{domain}"


def _client_display_name(user: User | None) -> str | None:
    if user is None:
        return None
    parts = [user.first_name, user.last_name]
    name = " ".join(part.strip() for part in parts if part and str(part).strip()).strip()
    if name:
        return name
    if user.client_id:
        return user.client_id
    return None


class MitraTxnRecommendationError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class CreateMitraTxnRecommendationItemInput:
    product_id: uuid.UUID
    amount_inr: Decimal
    number_of_installments: int | None = None
    installment_day: int | None = None


@dataclass(frozen=True, slots=True)
class CreateMitraTxnRecommendationInput:
    client_reference: str
    investment_type: MitraTxnInvestmentType
    payment_method: MitraTxnPaymentMethod
    items: list[CreateMitraTxnRecommendationItemInput]
    sip_frequency: str = "monthly"
    number_of_installments: int | None = None
    installment_day: int | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _build_investor_link(token: str) -> str:
    settings = get_settings()
    base = settings.frontend_url.rstrip("/")
    return f"{base}/dashboard/mutual-funds/recommendation/{token}"


def _expire_if_needed(row: MitraTxnRecommendation) -> None:
    if row.status not in {
        MitraTxnRecommendationStatus.sent,
        MitraTxnRecommendationStatus.opened,
    }:
        return
    if row.expires_at <= _now():
        row.status = MitraTxnRecommendationStatus.expired


def _serialize_item(
    item: MitraTxnRecommendationItem,
    *,
    amc: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "id": str(item.id),
        "product_id": str(item.product_id),
        "amount_inr": float(item.amount_inr),
        "number_of_installments": item.number_of_installments,
        "installment_day": item.installment_day,
        "fund_name": item.fund_name,
        "product_code": item.product_code,
        "fund_slug": item.fund_slug,
        "display_order": item.display_order,
    }
    if amc:
        payload.update(amc)
    return payload


def _summary_fund_name(items: list[MitraTxnRecommendationItem]) -> str:
    if not items:
        return "—"
    if len(items) == 1:
        return items[0].fund_name
    return f"{len(items)} funds"


def _total_amount(items: list[MitraTxnRecommendationItem]) -> Decimal:
    total = Decimal("0")
    for item in items:
        total += item.amount_inr
    return total


def _serialize_recommendation(
    row: MitraTxnRecommendation,
    items: list[MitraTxnRecommendationItem],
    *,
    link: str | None = None,
    client_code: str | None = None,
    client_email_masked: str | None = None,
    client_display_name: str | None = None,
    client_profile_image_url: str | None = None,
    amc_by_product_id: dict[uuid.UUID, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    _expire_if_needed(row)
    ordered_items = sorted(items, key=lambda item: (item.display_order, item.created_at))
    first = ordered_items[0] if ordered_items else None
    total_amount = _total_amount(ordered_items) if ordered_items else row.amount_inr
    fund_name = _summary_fund_name(ordered_items) if ordered_items else row.fund_name
    first_amc = (
        amc_by_product_id.get(first.product_id)
        if amc_by_product_id and first
        else None
    )
    return {
        "id": str(row.id),
        "token": row.token,
        "status": row.status.value,
        "investment_type": row.investment_type.value,
        "amount_inr": float(total_amount),
        "item_count": len(ordered_items),
        "items": [
            _serialize_item(
                item,
                amc=amc_by_product_id.get(item.product_id) if amc_by_product_id else None,
            )
            for item in ordered_items
        ],
        "number_of_installments": row.number_of_installments,
        "installment_day": row.installment_day,
        "sip_frequency": row.sip_frequency,
        "payment_method": row.payment_method.value,
        "fund_name": fund_name,
        "product_code": first.product_code if first else row.product_code,
        "fund_slug": first.fund_slug if first else row.fund_slug,
        "product_id": str(first.product_id) if first else str(row.product_id),
        "amc_name": first_amc.get("amc_name") if first_amc else None,
        "amc_slug": first_amc.get("amc_slug") if first_amc else None,
        "amc_logo_url": first_amc.get("amc_logo_url") if first_amc else None,
        "client_user_id": str(row.client_user_id),
        "mitra_user_id": str(row.mitra_user_id),
        "client_code": client_code,
        "client_email_masked": client_email_masked,
        "client_display_name": client_display_name,
        "client_profile_image_url": client_profile_image_url,
        "expires_at": row.expires_at.isoformat(),
        "opened_at": row.opened_at.isoformat() if row.opened_at else None,
        "invested_at": row.invested_at.isoformat() if row.invested_at else None,
        "created_at": row.created_at.isoformat(),
        "link": link,
    }


async def _load_product_amc_metadata(
    db: AsyncSession,
    product_ids: set[uuid.UUID],
) -> dict[uuid.UUID, dict[str, Any]]:
    if not product_ids:
        return {}

    from app.application.mf.public_asset_service import resolve_amc_logo_url
    from app.core.config import get_settings
    from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product

    rows = (
        await db.execute(
            select(Product.id, FundAmc.name, FundAmc.logo_url, FundAmc.slug)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .where(Product.id.in_(product_ids))
        )
    ).all()
    settings = get_settings()
    metadata: dict[uuid.UUID, dict[str, Any]] = {}
    for product_id, amc_name, logo_url, slug in rows:
        metadata[product_id] = {
            "amc_name": amc_name,
            "amc_slug": slug,
            "amc_logo_url": resolve_amc_logo_url(logo_url, slug, settings),
        }
    return metadata


async def _load_recommendation_items(
    db: AsyncSession,
    recommendation_id: uuid.UUID,
) -> list[MitraTxnRecommendationItem]:
    stmt = (
        select(MitraTxnRecommendationItem)
        .where(MitraTxnRecommendationItem.recommendation_id == recommendation_id)
        .order_by(MitraTxnRecommendationItem.display_order, MitraTxnRecommendationItem.created_at)
    )
    return list((await db.execute(stmt)).scalars())


async def _load_items_by_recommendation_ids(
    db: AsyncSession,
    recommendation_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[MitraTxnRecommendationItem]]:
    if not recommendation_ids:
        return {}
    stmt = (
        select(MitraTxnRecommendationItem)
        .where(MitraTxnRecommendationItem.recommendation_id.in_(recommendation_ids))
        .order_by(MitraTxnRecommendationItem.display_order, MitraTxnRecommendationItem.created_at)
    )
    rows = list((await db.execute(stmt)).scalars())
    grouped: dict[uuid.UUID, list[MitraTxnRecommendationItem]] = {}
    for item in rows:
        grouped.setdefault(item.recommendation_id, []).append(item)
    return grouped


async def _load_client_user(db: AsyncSession, client_reference: str) -> User:
    user = await get_user_by_reference(db, client_reference)
    if user is None or user.role != UserRole.user:
        raise MitraTxnRecommendationError("Client not found.", "client_not_found", 404)
    return user


async def _assert_client_kyc_ready(db: AsyncSession, client_user: User) -> None:
    compliant_ids = await _kyc_compliant_user_ids(db, [client_user.id])
    if client_user.id not in compliant_ids:
        raise MitraTxnRecommendationError(
            "Client KYC must be complete before sending a recommendation.",
            "client_kyc_incomplete",
            400,
        )


async def _load_product(db: AsyncSession, product_id: uuid.UUID) -> Product:
    product = await db.get(Product, product_id)
    if product is None:
        raise MitraTxnRecommendationError("Fund not found.", "fund_not_found", 404)
    return product


async def create_mitra_txn_recommendation(
    db: AsyncSession,
    *,
    actor: User,
    payload: CreateMitraTxnRecommendationInput,
) -> dict[str, Any]:
    if not payload.items:
        raise MitraTxnRecommendationError("Add at least one fund.", "items_required", 400)
    if len(payload.items) > MITRA_TXN_RECOMMENDATION_MAX_ITEMS:
        raise MitraTxnRecommendationError(
            f"You can recommend up to {MITRA_TXN_RECOMMENDATION_MAX_ITEMS} funds per link.",
            "too_many_items",
            400,
        )

    product_ids = [item.product_id for item in payload.items]
    if len(set(product_ids)) != len(product_ids):
        raise MitraTxnRecommendationError(
            "Each fund can only appear once in a recommendation.",
            "duplicate_product",
            400,
        )

    client_user = await _load_client_user(db, payload.client_reference)
    await assert_actor_can_access_client(db, actor=actor, client_user=client_user)
    await _assert_client_kyc_ready(db, client_user)

    default_installments = payload.number_of_installments
    default_installment_day = payload.installment_day or 1
    if payload.investment_type == MitraTxnInvestmentType.sip:
        if default_installments is None or default_installments < 1:
            raise MitraTxnRecommendationError(
                "SIP recommendations require at least one installment.",
                "invalid_sip_installments",
                400,
            )
    else:
        default_installments = None
        default_installment_day = None

    item_rows: list[MitraTxnRecommendationItem] = []
    total_amount = Decimal("0")
    for index, item_input in enumerate(payload.items):
        if item_input.amount_inr <= 0:
            raise MitraTxnRecommendationError("Amount must be positive.", "invalid_amount", 400)

        product = await _load_product(db, item_input.product_id)
        display = await db.get(ProductDisplayContent, product.id)
        fund_slug = display.seo_slug if display and display.seo_slug else str(product.id)
        installments = item_input.number_of_installments
        installment_day = item_input.installment_day
        if payload.investment_type == MitraTxnInvestmentType.sip:
            installments = installments if installments is not None else default_installments
            installment_day = installment_day if installment_day is not None else default_installment_day
            if installments is None or installments < 1:
                raise MitraTxnRecommendationError(
                    "SIP recommendations require at least one installment.",
                    "invalid_sip_installments",
                    400,
                )
        else:
            installments = None
            installment_day = None

        total_amount += item_input.amount_inr
        item_rows.append(
            MitraTxnRecommendationItem(
                product_id=product.id,
                amount_inr=item_input.amount_inr,
                number_of_installments=installments,
                installment_day=installment_day,
                fund_name=product.name,
                product_code=product.code,
                fund_slug=fund_slug,
                display_order=index,
            )
        )

    first_product = item_rows[0]
    token = secrets.token_urlsafe(32)
    expires_at = _now() + timedelta(hours=RECOMMENDATION_TTL_HOURS)

    row = MitraTxnRecommendation(
        token=token,
        mitra_user_id=actor.id,
        client_user_id=client_user.id,
        product_id=first_product.product_id,
        investment_type=payload.investment_type,
        amount_inr=total_amount,
        number_of_installments=default_installments,
        installment_day=default_installment_day if payload.investment_type == MitraTxnInvestmentType.sip else None,
        sip_frequency=payload.sip_frequency,
        payment_method=payload.payment_method,
        status=MitraTxnRecommendationStatus.sent,
        fund_name=_summary_fund_name(item_rows),
        product_code=first_product.product_code,
        fund_slug=first_product.fund_slug,
        expires_at=expires_at,
    )
    db.add(row)
    await db.flush()

    for item_row in item_rows:
        item_row.recommendation_id = row.id
        db.add(item_row)
    await db.flush()

    link = _build_investor_link(token)
    from app.application.distributor.mitra_txn_recommendation_notifications import (
        notify_client_mitra_txn_recommendation,
    )

    await notify_client_mitra_txn_recommendation(
        db,
        recommendation=row,
        items=item_rows,
        client_user=client_user,
        link=link,
    )

    amc_by_product_id = await _load_product_amc_metadata(
        db,
        {item.product_id for item in item_rows},
    )
    from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id

    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=[client_user.id])

    return _serialize_recommendation(
        row,
        item_rows,
        link=link,
        client_code=client_user.client_id,
        client_email_masked=_mask_email(client_user.email),
        client_display_name=_client_display_name(client_user),
        client_profile_image_url=profile_images.get(client_user.id),
        amc_by_product_id=amc_by_product_id,
    )


async def list_mitra_txn_recommendations_for_actor(
    db: AsyncSession,
    *,
    actor: User,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    from sqlalchemy import or_

    from app.application.admin.rbac_service import MITRA_MANAGER_ROLE_KEY, MITRA_ROLE_KEY, list_user_role_keys

    role_keys = await list_user_role_keys(db, actor.id)
    stmt = select(MitraTxnRecommendation).order_by(MitraTxnRecommendation.created_at.desc())

    if MITRA_MANAGER_ROLE_KEY in role_keys and MITRA_ROLE_KEY not in role_keys:
        client_ids = await list_book_client_user_ids_for_actor(db, actor=actor)
        if not client_ids:
            return []
        stmt = stmt.where(MitraTxnRecommendation.client_user_id.in_(client_ids))
    else:
        book_client_ids = await list_book_client_user_ids_for_actor(db, actor=actor)
        if book_client_ids:
            stmt = stmt.where(
                or_(
                    MitraTxnRecommendation.mitra_user_id == actor.id,
                    MitraTxnRecommendation.client_user_id.in_(book_client_ids),
                )
            )
        else:
            stmt = stmt.where(MitraTxnRecommendation.mitra_user_id == actor.id)

    rows = list((await db.execute(stmt.offset(offset).limit(limit))).scalars())
    client_ids = {row.client_user_id for row in rows}
    clients: dict[uuid.UUID, User] = {}
    if client_ids:
        client_rows = list(
            (await db.execute(select(User).where(User.id.in_(client_ids)))).scalars()
        )
        clients = {user.id: user for user in client_rows}

    for row in rows:
        _expire_if_needed(row)
    items_by_rec = await _load_items_by_recommendation_ids(db, [row.id for row in rows])
    product_ids = {
        item.product_id
        for items in items_by_rec.values()
        for item in items
    }
    amc_by_product_id = await _load_product_amc_metadata(db, product_ids)
    from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id

    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=list(client_ids))
    return [
        _serialize_recommendation(
            row,
            items_by_rec.get(row.id, []),
            link=_build_investor_link(row.token),
            client_code=clients[row.client_user_id].client_id if row.client_user_id in clients else None,
            client_email_masked=_mask_email(clients[row.client_user_id].email)
            if row.client_user_id in clients
            else None,
            client_display_name=_client_display_name(clients.get(row.client_user_id)),
            client_profile_image_url=profile_images.get(row.client_user_id),
            amc_by_product_id=amc_by_product_id,
        )
        for row in rows
    ]


async def get_mitra_txn_recommendation_for_actor(
    db: AsyncSession,
    *,
    actor: User,
    token: str,
) -> dict[str, Any] | None:
    row = await _get_recommendation_by_token(db, token)
    if row is None:
        return None
    client_ids = await list_book_client_user_ids_for_actor(db, actor=actor)
    if row.client_user_id not in client_ids and row.mitra_user_id != actor.id:
        return None
    items = await _load_recommendation_items(db, row.id)
    return _serialize_recommendation(row, items, link=_build_investor_link(row.token))


async def _get_recommendation_by_token(
    db: AsyncSession,
    token: str,
) -> MitraTxnRecommendation | None:
    stmt = select(MitraTxnRecommendation).where(MitraTxnRecommendation.token == token)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        return None
    _expire_if_needed(row)
    return row


async def get_mitra_txn_recommendation_for_investor(
    db: AsyncSession,
    *,
    investor: User,
    token: str,
) -> dict[str, Any]:
    row = await _get_recommendation_by_token(db, token)
    if row is None:
        raise MitraTxnRecommendationError("Recommendation not found.", "not_found", 404)
    if row.client_user_id != investor.id:
        raise MitraTxnRecommendationError(
            "This recommendation belongs to another investor.",
            "forbidden",
            403,
        )
    if row.status == MitraTxnRecommendationStatus.expired:
        raise MitraTxnRecommendationError(
            "This recommendation link has expired.",
            "expired",
            410,
        )
    if row.status == MitraTxnRecommendationStatus.cancelled:
        raise MitraTxnRecommendationError(
            "This recommendation was cancelled.",
            "cancelled",
            410,
        )
    items = await _load_recommendation_items(db, row.id)
    first = items[0] if items else None
    return {
        **_serialize_recommendation(row, items),
        "cart_path": "/dashboard/mutual-funds/cart",
        "fund_path": (
            f"/dashboard/mutual-funds/funds/{first.fund_slug or first.product_id}"
            if first
            else "/dashboard/mutual-funds/cart"
        ),
    }


async def apply_mitra_txn_recommendation_for_investor(
    db: AsyncSession,
    *,
    investor: User,
    token: str,
) -> dict[str, Any]:
    row = await _get_recommendation_by_token(db, token)
    if row is None:
        raise MitraTxnRecommendationError("Recommendation not found.", "not_found", 404)
    if row.client_user_id != investor.id:
        raise MitraTxnRecommendationError(
            "This recommendation belongs to another investor.",
            "forbidden",
            403,
        )
    if row.status in {MitraTxnRecommendationStatus.expired, MitraTxnRecommendationStatus.cancelled}:
        raise MitraTxnRecommendationError(
            "This recommendation is no longer active.",
            row.status.value,
            410,
        )

    cart_type = (
        MfCartInvestmentType.sip
        if row.investment_type == MitraTxnInvestmentType.sip
        else MfCartInvestmentType.lumpsum
    )
    items = await _load_recommendation_items(db, row.id)
    if not items:
        raise MitraTxnRecommendationError(
            "This recommendation has no funds to apply.",
            "items_missing",
            400,
        )

    try:
        for item in items:
            await upsert_cart_item(
                db,
                user_id=investor.id,
                product_id=item.product_id,
                amount_inr=item.amount_inr,
                investment_type=cart_type,
                installment_day=item.installment_day,
                frequency=row.sip_frequency,
                number_of_installments=item.number_of_installments,
            )
    except MfOrderError as exc:
        raise MitraTxnRecommendationError(exc.message, exc.code, 400) from exc

    if row.status == MitraTxnRecommendationStatus.sent:
        row.status = MitraTxnRecommendationStatus.opened
        row.opened_at = _now()

    return {
        "applied": True,
        "status": row.status.value,
        "redirect_path": "/dashboard/mutual-funds/cart",
        "recommendation": _serialize_recommendation(row, items),
    }


async def search_distributor_schemes(
    db: AsyncSession,
    *,
    query: str,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    payload = await cached_search_invest_funds(db, query=query, page=page, page_size=page_size)
    items = []
    for item in payload.get("items") or []:
        min_lumpsum = item.get("min_lumpsum_amount_inr")
        min_sip = item.get("min_sip_amount_inr")
        items.append(
            {
                "product_id": item.get("product_id"),
                "slug": item.get("slug"),
                "product_code": item.get("product_code"),
                "name": item.get("name"),
                "amc_name": item.get("amc_name"),
                "amc_slug": item.get("amc_slug"),
                "amc_logo_url": item.get("amc_logo_url"),
                "category_slug": item.get("category_slug"),
                "isin": item.get("isin"),
                "min_lumpsum_amount_inr": min_lumpsum,
                "min_sip_amount_inr": min_sip,
                "sip_allowed": item.get("sip_allowed", True),
            }
        )
    return {
        "query": payload.get("query", query),
        "items": items,
        "page": payload.get("page", page),
        "page_size": payload.get("page_size", page_size),
        "total": payload.get("total", len(items)),
        "has_more": payload.get("has_more", False),
    }
