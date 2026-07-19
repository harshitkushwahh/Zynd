from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    AmcDisplayContent,
    FundAmc,
    MfComplianceSettings,
    MutualFund,
    Product,
    ProductDisplayContent,
)
from app.infrastructure.persistence.models import AuditEventType

_COMPLIANCE_ROW_ID = 1


def _content_snapshot(row: ProductDisplayContent | None) -> dict:
    if not row:
        return {}
    return {
        "tagline": row.tagline,
        "hero_badge": row.hero_badge,
        "risk_label": row.risk_label,
        "benchmark_name": row.benchmark_name,
        "fund_manager_name": row.fund_manager_name,
        "disclaimer_text": row.disclaimer_text,
        "seo_slug": row.seo_slug,
        "seo_meta_description": row.seo_meta_description,
    }


def _amc_content_snapshot(row: AmcDisplayContent | None) -> dict:
    if not row:
        return {}
    return {
        "marketing_name": row.marketing_name,
        "description": row.description,
        "website_url": row.website_url,
    }


def _compliance_snapshot(row: MfComplianceSettings | None) -> dict:
    if not row:
        return {}
    return {
        "default_disclaimer": row.default_disclaimer,
        "distributor_arn": row.distributor_arn,
        "distributor_euin": row.distributor_euin,
    }


def serialize_product_content(row: ProductDisplayContent | None) -> dict:
    if not row:
        return {
            "tagline": None,
            "hero_badge": None,
            "risk_label": None,
            "benchmark_name": None,
            "fund_manager_name": None,
            "disclaimer_text": None,
            "seo_slug": None,
            "seo_meta_description": None,
            "updated_at": None,
        }
    return {
        "tagline": row.tagline,
        "hero_badge": row.hero_badge,
        "risk_label": row.risk_label,
        "benchmark_name": row.benchmark_name,
        "fund_manager_name": row.fund_manager_name,
        "disclaimer_text": row.disclaimer_text,
        "seo_slug": row.seo_slug,
        "seo_meta_description": row.seo_meta_description,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def serialize_amc_content(row: AmcDisplayContent | None) -> dict:
    if not row:
        return {
            "marketing_name": None,
            "description": None,
            "website_url": None,
            "updated_at": None,
        }
    return {
        "marketing_name": row.marketing_name,
        "description": row.description,
        "website_url": row.website_url,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


async def _get_compliance_row(session: AsyncSession) -> MfComplianceSettings:
    row = await session.get(MfComplianceSettings, _COMPLIANCE_ROW_ID)
    if row:
        return row
    row = MfComplianceSettings(id=_COMPLIANCE_ROW_ID)
    session.add(row)
    await session.flush()
    return row


async def get_compliance_settings_admin(session: AsyncSession) -> dict:
    settings = get_settings()
    row = await _get_compliance_row(session)
    return {
        "default_disclaimer": row.default_disclaimer or settings.zynd_mf_invest_disclaimer,
        "distributor_arn": row.distributor_arn or settings.zynd_distributor_arn or None,
        "distributor_euin": row.distributor_euin or settings.zynd_distributor_euin or None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "source": {
            "default_disclaimer": "database" if row.default_disclaimer else "config",
            "distributor_arn": "database" if row.distributor_arn else "config",
            "distributor_euin": "database" if row.distributor_euin else "config",
        },
    }


async def get_compliance_settings_public(session: AsyncSession) -> dict:
    settings = get_settings()
    row = await session.get(MfComplianceSettings, _COMPLIANCE_ROW_ID)
    return {
        "default_disclaimer": (
            row.default_disclaimer
            if row and row.default_disclaimer
            else settings.zynd_mf_invest_disclaimer
        ),
        "distributor_arn": (
            row.distributor_arn
            if row and row.distributor_arn
            else settings.zynd_distributor_arn or None
        ),
        "distributor_euin": (
            row.distributor_euin
            if row and row.distributor_euin
            else settings.zynd_distributor_euin or None
        ),
    }


async def update_compliance_settings_admin(
    session: AsyncSession,
    *,
    admin_user_id: UUID,
    default_disclaimer: str | None = None,
    distributor_arn: str | None = None,
    distributor_euin: str | None = None,
    clear_default_disclaimer: bool = False,
    clear_distributor_arn: bool = False,
    clear_distributor_euin: bool = False,
) -> dict:
    row = await _get_compliance_row(session)
    before = _compliance_snapshot(row)

    if clear_default_disclaimer:
        row.default_disclaimer = None
    elif default_disclaimer is not None:
        row.default_disclaimer = default_disclaimer.strip() or None

    if clear_distributor_arn:
        row.distributor_arn = None
    elif distributor_arn is not None:
        row.distributor_arn = distributor_arn.strip() or None

    if clear_distributor_euin:
        row.distributor_euin = None
    elif distributor_euin is not None:
        row.distributor_euin = distributor_euin.strip() or None

    row.updated_by = admin_user_id
    row.updated_at = datetime.now(timezone.utc)
    await session.flush()

    await write_audit(
        session,
        event_type=AuditEventType.mf_compliance_settings_updated,
        user_id=admin_user_id,
        metadata={"before": before, "after": _compliance_snapshot(row)},
    )
    await notify_invest_catalog_changed(session)
    return await get_compliance_settings_admin(session)


async def get_product_content_by_fund_id(session: AsyncSession, fund_id: int) -> dict | None:
    row = (
        await session.execute(
            select(MutualFund, Product, ProductDisplayContent)
            .outerjoin(Product, Product.id == MutualFund.product_id)
            .outerjoin(ProductDisplayContent, ProductDisplayContent.product_id == Product.id)
            .where(MutualFund.id == fund_id)
        )
    ).first()
    if not row:
        return None
    fund, product, content = row
    if not product:
        return {
            "fund_id": fund.id,
            "product_id": None,
            "content": serialize_product_content(None),
        }
    return {
        "fund_id": fund.id,
        "product_id": str(product.id),
        "content": serialize_product_content(content),
    }


async def get_product_content_for_invest(
    session: AsyncSession,
    product_id: UUID,
    *,
    amc_id: int | None = None,
) -> dict:
    content = await session.scalar(
        select(ProductDisplayContent).where(ProductDisplayContent.product_id == product_id)
    )
    payload = serialize_product_content(content)
    if amc_id is not None:
        amc_content = await session.scalar(
            select(AmcDisplayContent).where(AmcDisplayContent.amc_id == amc_id)
        )
        amc_payload = serialize_amc_content(amc_content)
        payload["amc_marketing_name"] = amc_payload["marketing_name"]
        payload["amc_description"] = amc_payload["description"]
        payload["amc_website_url"] = amc_payload["website_url"]
    return payload


async def update_product_content_by_fund_id(
    session: AsyncSession,
    fund_id: int,
    *,
    admin_user_id: UUID,
    tagline: str | None = None,
    hero_badge: str | None = None,
    risk_label: str | None = None,
    benchmark_name: str | None = None,
    fund_manager_name: str | None = None,
    disclaimer_text: str | None = None,
    seo_slug: str | None = None,
    seo_meta_description: str | None = None,
) -> dict | None:
    row = (
        await session.execute(
            select(MutualFund, Product).outerjoin(Product, Product.id == MutualFund.product_id).where(
                MutualFund.id == fund_id
            )
        )
    ).first()
    if not row:
        return None
    fund, product = row
    if not product:
        raise ValueError("Fund has no linked product")

    content = await session.scalar(
        select(ProductDisplayContent).where(ProductDisplayContent.product_id == product.id)
    )
    before = _content_snapshot(content)
    if content is None:
        content = ProductDisplayContent(product_id=product.id)
        session.add(content)

    fields = {
        "tagline": tagline,
        "hero_badge": hero_badge,
        "risk_label": risk_label,
        "benchmark_name": benchmark_name,
        "fund_manager_name": fund_manager_name,
        "disclaimer_text": disclaimer_text,
        "seo_slug": seo_slug,
        "seo_meta_description": seo_meta_description,
    }
    for key, value in fields.items():
        if value is not None:
            setattr(content, key, value.strip() or None)

    content.updated_by = admin_user_id
    content.updated_at = datetime.now(timezone.utc)
    await session.flush()

    await write_audit(
        session,
        event_type=AuditEventType.mf_product_content_updated,
        user_id=admin_user_id,
        metadata={
            "fund_id": fund.id,
            "product_id": str(product.id),
            "before": before,
            "after": _content_snapshot(content),
        },
    )
    await notify_invest_catalog_changed(session)
    return await get_product_content_by_fund_id(session, fund_id)


async def get_amc_content_admin(session: AsyncSession, amc_id: int) -> dict | None:
    amc = await session.get(FundAmc, amc_id)
    if not amc:
        return None
    content = await session.scalar(
        select(AmcDisplayContent).where(AmcDisplayContent.amc_id == amc_id)
    )
    return {
        "amc_id": amc.id,
        "amc_name": amc.name,
        "content": serialize_amc_content(content),
    }


async def update_amc_content_admin(
    session: AsyncSession,
    amc_id: int,
    *,
    admin_user_id: UUID,
    marketing_name: str | None = None,
    description: str | None = None,
    website_url: str | None = None,
) -> dict | None:
    amc = await session.get(FundAmc, amc_id)
    if not amc:
        return None

    content = await session.scalar(
        select(AmcDisplayContent).where(AmcDisplayContent.amc_id == amc_id)
    )
    before = _amc_content_snapshot(content)
    if content is None:
        content = AmcDisplayContent(amc_id=amc_id)
        session.add(content)

    if marketing_name is not None:
        content.marketing_name = marketing_name.strip() or None
    if description is not None:
        content.description = description.strip() or None
    if website_url is not None:
        content.website_url = website_url.strip() or None

    content.updated_by = admin_user_id
    content.updated_at = datetime.now(timezone.utc)
    await session.flush()

    await write_audit(
        session,
        event_type=AuditEventType.mf_amc_content_updated,
        user_id=admin_user_id,
        metadata={"amc_id": amc_id, "before": before, "after": _amc_content_snapshot(content)},
    )
    await notify_invest_catalog_changed(session)
    return await get_amc_content_admin(session, amc_id)


def resolve_effective_disclaimer(
    *,
    product_disclaimer: str | None,
    compliance: dict,
) -> str:
    if product_disclaimer and product_disclaimer.strip():
        return product_disclaimer.strip()
    return compliance.get("default_disclaimer") or get_settings().zynd_mf_invest_disclaimer
