from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.schemas import (
    MfAddCategoryFundRequest,
    MfAmcListResponse,
    MfAmcResponse,
    MfBulkAddAmcFundsRequest,
    MfBulkAddAmcFundsResponse,
    MfBulkCatalogJobListResponse,
    MfBulkCatalogJobResponse,
    MfBulkCatalogPreviewRequest,
    MfBulkCatalogSubmitRequest,
    MfCatalogOverviewResponse,
    MfAmcContentResponse,
    MfCatalogHealthIssueListResponse,
    MfCatalogRuleListResponse,
    MfCatalogRuleResponse,
    MfCatalogRulesApplyRequest,
    MfCatalogRulesPreviewRequest,
    MfCatalogRulesPreviewResponse,
    MfCreateCatalogRuleRequest,
    MfCatalogHealthIssueResponse,
    MfCatalogHealthSummaryResponse,
    MfCategoryAdminListResponse,
    MfCategoryAdminResponse,
    MfCategoryFundCurationItem,
    MfCategoryFundsCurationResponse,
    MfComplianceSettingsResponse,
    MfFundAdminDetailResponse,
    MfFundAdminListResponse,
    MfFundAdminResponse,
    MfFundContentResponse,
    MfFundNavHistoryResponse,
    MfIngestionRunListResponse,
    MfIngestionRunResponse,
    MfJobListResponse,
    MfJobResponse,
    MfStagingBatchListResponse,
    MfStagingBatchResponse,
    MfStagingRejectRequest,
    MfStagingRowListResponse,
    MfStagingRowResponse,
    MfRunJobResponse,
    MfSetCategoryOrderRequest,
    MfUpdateAmcRequest,
    MfUpdateAmcContentRequest,
    MfUpdateCategoryRequest,
    MfUpdateComplianceSettingsRequest,
    MfUpdateCatalogRuleRequest,
    MfUpdateFundContentRequest,
    MfUpdateFundRequest,
)
from app.api.v1.auth.deps import require_permission
from app.application.admin.admin_action_service import create_admin_action_request
from app.application.mf.amc_admin_service import list_amcs_admin
from app.application.mf.catalog_admin_service import (
    get_catalog_overview,
    get_fund_admin,
    list_categories_admin,
    list_fund_navs_admin,
    list_funds_admin,
)
from app.application.mf.catalog_bulk_service import (
    create_bulk_catalog_job,
    get_bulk_catalog_job,
    list_bulk_catalog_jobs,
    preview_bulk_catalog,
)
from app.application.mf.catalog_rules_service import (
    apply_catalog_rules,
    create_catalog_rule,
    get_catalog_rule,
    list_catalog_rules,
    preview_catalog_rules,
    update_catalog_rule,
)
from app.application.mf.category_curation_service import (
    add_fund_to_category,
    bulk_add_amc_funds_to_category,
    get_category_admin,
    list_category_funds_admin,
    remove_fund_from_category,
    set_category_fund_order,
    update_category_admin,
)
from app.application.mf.catalog_admin_write_service import (
    update_amc_catalog_admin,
    update_fund_catalog_admin,
)
from app.application.mf.catalog_health_service import get_catalog_health, list_catalog_health_issues
from app.application.mf.product_content_service import (
    get_amc_content_admin,
    get_compliance_settings_admin,
    get_product_content_by_fund_id,
    update_amc_content_admin,
    update_compliance_settings_admin,
    update_product_content_by_fund_id,
)
from app.application.mf.scheme_staging_admin_service import (
    approve_scheme_staging_batch,
    get_scheme_staging_batch,
    list_scheme_staging_batch_rows,
    list_scheme_staging_batches,
    reject_scheme_staging_batch,
)
from app.application.mf.scheme_staging_promote_service import run_cybrilla_scheme_promote
from app.infrastructure.persistence.mf_models import AdminInvestability, AdminVisibility, MfBulkCatalogJob
from app.infrastructure.persistence.models import AdminActionType, User
from app.application.mf.mf_admin_service import (
    list_mf_ingestion_runs,
    list_mf_jobs_with_status,
    trigger_mf_job,
)
from app.application.mf.mf_scheduler_metrics import get_mf_prometheus_metrics
from app.core.config import get_settings
from app.core.database import get_db

router = APIRouter(prefix="/mf", tags=["admin-mf"])


@router.get("/overview", response_model=MfCatalogOverviewResponse)
async def mf_catalog_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfCatalogOverviewResponse:
    return MfCatalogOverviewResponse(**await get_catalog_overview(db))


@router.get("/catalog/health", response_model=MfCatalogHealthSummaryResponse)
async def mf_catalog_health(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfCatalogHealthSummaryResponse:
    payload = await get_catalog_health(db)
    return MfCatalogHealthSummaryResponse(**payload)


@router.get("/catalog/health/issues", response_model=MfCatalogHealthIssueListResponse)
async def mf_catalog_health_issues(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
    check: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> MfCatalogHealthIssueListResponse:
    result = await list_catalog_health_issues(
        db,
        check=check,
        page=page,
        page_size=page_size,
    )
    return MfCatalogHealthIssueListResponse(
        items=[MfCatalogHealthIssueResponse(**item) for item in result["items"]],
        page=result["page"],
        page_size=result["page_size"],
        total=result["total"],
        has_more=result["has_more"],
    )


@router.get("/categories", response_model=MfCategoryAdminListResponse)
async def list_mf_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfCategoryAdminListResponse:
    categories = await list_categories_admin(db)
    return MfCategoryAdminListResponse(
        categories=[MfCategoryAdminResponse(**item) for item in categories]
    )


@router.get("/categories/{category_id}", response_model=MfCategoryAdminResponse)
async def get_mf_category(
    category_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfCategoryAdminResponse:
    category = await get_category_admin(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return MfCategoryAdminResponse(**category)


@router.patch("/categories/{category_id}", response_model=MfCategoryAdminResponse)
async def update_mf_category(
    category_id: int,
    body: MfUpdateCategoryRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.manage"))],
) -> MfCategoryAdminResponse:
    if (
        body.name is None
        and body.is_visible is None
        and body.display_order is None
        and body.min_funds_to_show is None
    ):
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    updated = await update_category_admin(
        db,
        category_id,
        admin_user_id=admin.id,
        name=body.name,
        is_visible=body.is_visible,
        display_order=body.display_order,
        min_funds_to_show=body.min_funds_to_show,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.commit()
    return MfCategoryAdminResponse(**updated)


@router.get("/categories/{category_slug}/funds", response_model=MfCategoryFundsCurationResponse)
async def list_mf_category_funds(
    category_slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfCategoryFundsCurationResponse:
    payload = await list_category_funds_admin(db, category_slug)
    if not payload:
        raise HTTPException(status_code=404, detail="Category not found")
    category = payload["category"]
    return MfCategoryFundsCurationResponse(
        category=MfCategoryAdminResponse(
            **category,
            fund_count=len(payload["items"]),
            active_fund_count=sum(
                1 for item in payload["items"] if item["lifecycle_status"] == "ACTIVE"
            ),
        ),
        items=[MfCategoryFundCurationItem(**item) for item in payload["items"]],
    )


@router.put("/categories/{category_slug}/order", response_model=MfCategoryFundsCurationResponse)
async def set_mf_category_fund_order(
    category_slug: str,
    body: MfSetCategoryOrderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.manage"))],
) -> MfCategoryFundsCurationResponse:
    payload = await set_category_fund_order(
        db,
        category_slug,
        admin_user_id=admin.id,
        items=[item.model_dump() for item in body.items],
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.commit()
    category = payload["category"]
    return MfCategoryFundsCurationResponse(
        category=MfCategoryAdminResponse(
            **category,
            fund_count=len(payload["items"]),
            active_fund_count=sum(
                1 for item in payload["items"] if item["lifecycle_status"] == "ACTIVE"
            ),
        ),
        items=[MfCategoryFundCurationItem(**item) for item in payload["items"]],
    )


@router.post("/categories/{category_slug}/funds", response_model=MfCategoryFundsCurationResponse)
async def add_mf_category_fund(
    category_slug: str,
    body: MfAddCategoryFundRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.manage"))],
) -> MfCategoryFundsCurationResponse:
    try:
        payload = await add_fund_to_category(
            db,
            category_slug,
            admin_user_id=admin.id,
            product_id=uuid.UUID(body.product_id),
            display_order=body.display_order,
            is_featured=body.is_featured,
            featured_rank=body.featured_rank,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not payload:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.commit()
    category = payload["category"]
    return MfCategoryFundsCurationResponse(
        category=MfCategoryAdminResponse(
            **category,
            fund_count=len(payload["items"]),
            active_fund_count=sum(
                1 for item in payload["items"] if item["lifecycle_status"] == "ACTIVE"
            ),
        ),
        items=[MfCategoryFundCurationItem(**item) for item in payload["items"]],
    )


@router.delete("/categories/{category_slug}/funds/{product_id}", response_model=MfCategoryFundsCurationResponse)
async def remove_mf_category_fund(
    category_slug: str,
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.manage"))],
) -> MfCategoryFundsCurationResponse:
    payload = await remove_fund_from_category(
        db,
        category_slug,
        admin_user_id=admin.id,
        product_id=uuid.UUID(product_id),
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.commit()
    category = payload["category"]
    return MfCategoryFundsCurationResponse(
        category=MfCategoryAdminResponse(
            **category,
            fund_count=len(payload["items"]),
            active_fund_count=sum(
                1 for item in payload["items"] if item["lifecycle_status"] == "ACTIVE"
            ),
        ),
        items=[MfCategoryFundCurationItem(**item) for item in payload["items"]],
    )


@router.post("/categories/{category_slug}/funds/bulk-amc", response_model=MfBulkAddAmcFundsResponse)
async def bulk_add_mf_category_amc_funds(
    category_slug: str,
    body: MfBulkAddAmcFundsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.manage"))],
) -> MfBulkAddAmcFundsResponse:
    result = await bulk_add_amc_funds_to_category(
        db,
        category_slug,
        admin_user_id=admin.id,
        amc_id=body.amc_id,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.commit()
    category_payload = result["category"]
    category = category_payload["category"]
    return MfBulkAddAmcFundsResponse(
        added=result["added"],
        category=MfCategoryFundsCurationResponse(
            category=MfCategoryAdminResponse(
                **category,
                fund_count=len(category_payload["items"]),
                active_fund_count=sum(
                    1
                    for item in category_payload["items"]
                    if item["lifecycle_status"] == "ACTIVE"
                ),
            ),
            items=[MfCategoryFundCurationItem(**item) for item in category_payload["items"]],
        ),
    )


@router.get("/funds", response_model=MfFundAdminListResponse)
async def list_mf_funds(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    q: Optional[str] = Query(default=None),
    amc_id: Optional[int] = Query(default=None),
    category_slug: Optional[str] = Query(default=None),
    lifecycle_status: Optional[str] = Query(default=None),
    fund_active: Optional[bool] = Query(default=None),
    amc_empanelled: Optional[bool] = Query(default=None),
    purchasable: Optional[bool] = Query(default=None),
) -> MfFundAdminListResponse:
    result = await list_funds_admin(
        db,
        page=page,
        page_size=page_size,
        q=q,
        amc_id=amc_id,
        category_slug=category_slug,
        lifecycle_status=lifecycle_status,
        fund_active=fund_active,
        amc_empanelled=amc_empanelled,
        purchasable=purchasable,
    )
    return MfFundAdminListResponse(
        items=[MfFundAdminResponse(**item) for item in result["items"]],
        page=result["page"],
        page_size=result["page_size"],
        total=result["total"],
        has_more=result["has_more"],
    )


@router.get("/funds/{fund_id}", response_model=MfFundAdminDetailResponse)
async def get_mf_fund(
    fund_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfFundAdminDetailResponse:
    detail = await get_fund_admin(db, fund_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Fund not found")
    return MfFundAdminDetailResponse(**detail)


@router.get("/funds/{fund_id}/navs", response_model=MfFundNavHistoryResponse)
async def list_mf_fund_navs(
    fund_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    limit: int = Query(default=365, ge=1, le=2000),
) -> MfFundNavHistoryResponse:
    history = await list_fund_navs_admin(
        db,
        fund_id,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
    )
    if not history:
        raise HTTPException(status_code=404, detail="Fund not found")
    return MfFundNavHistoryResponse(**history)


@router.patch("/funds/{fund_id}", response_model=MfFundAdminDetailResponse)
async def update_mf_fund(
    fund_id: int,
    body: MfUpdateFundRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.manage"))],
) -> MfFundAdminDetailResponse:
    if (
        body.is_active is None
        and body.admin_visibility is None
        and body.admin_investability is None
    ):
        raise HTTPException(status_code=400, detail="Provide at least one field to update")

    visibility = AdminVisibility(body.admin_visibility) if body.admin_visibility else None
    investability = (
        AdminInvestability(body.admin_investability) if body.admin_investability else None
    )

    try:
        updated = await update_fund_catalog_admin(
            db,
            fund_id,
            admin_user_id=admin.id,
            is_active=body.is_active,
            admin_visibility=visibility,
            admin_investability=investability,
            reason=body.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not updated:
        raise HTTPException(status_code=404, detail="Fund not found")
    await db.commit()
    return MfFundAdminDetailResponse(**updated)


@router.get("/compliance", response_model=MfComplianceSettingsResponse)
async def get_mf_compliance_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfComplianceSettingsResponse:
    return MfComplianceSettingsResponse(**await get_compliance_settings_admin(db))


@router.patch("/compliance", response_model=MfComplianceSettingsResponse)
async def update_mf_compliance_settings(
    body: MfUpdateComplianceSettingsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.content.manage"))],
) -> MfComplianceSettingsResponse:
    updated = await update_compliance_settings_admin(
        db,
        admin_user_id=admin.id,
        default_disclaimer=body.default_disclaimer,
        distributor_arn=body.distributor_arn,
        distributor_euin=body.distributor_euin,
        clear_default_disclaimer=body.clear_default_disclaimer,
        clear_distributor_arn=body.clear_distributor_arn,
        clear_distributor_euin=body.clear_distributor_euin,
    )
    await db.commit()
    return MfComplianceSettingsResponse(**updated)


@router.get("/funds/{fund_id}/content", response_model=MfFundContentResponse)
async def get_mf_fund_content(
    fund_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfFundContentResponse:
    payload = await get_product_content_by_fund_id(db, fund_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found")
    return MfFundContentResponse(**payload)


@router.patch("/funds/{fund_id}/content", response_model=MfFundContentResponse)
async def update_mf_fund_content(
    fund_id: int,
    body: MfUpdateFundContentRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.content.manage"))],
) -> MfFundContentResponse:
    if not body.model_fields_set:
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    try:
        updated = await update_product_content_by_fund_id(
            db,
            fund_id,
            admin_user_id=admin.id,
            tagline=body.tagline,
            hero_badge=body.hero_badge,
            risk_label=body.risk_label,
            benchmark_name=body.benchmark_name,
            fund_manager_name=body.fund_manager_name,
            disclaimer_text=body.disclaimer_text,
            seo_slug=body.seo_slug,
            seo_meta_description=body.seo_meta_description,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Fund not found")
    await db.commit()
    return MfFundContentResponse(**updated)


@router.get("/amcs/{amc_id}/content", response_model=MfAmcContentResponse)
async def get_mf_amc_content(
    amc_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfAmcContentResponse:
    payload = await get_amc_content_admin(db, amc_id)
    if not payload:
        raise HTTPException(status_code=404, detail="AMC not found")
    return MfAmcContentResponse(**payload)


@router.patch("/amcs/{amc_id}/content", response_model=MfAmcContentResponse)
async def update_mf_amc_content(
    amc_id: int,
    body: MfUpdateAmcContentRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.content.manage"))],
) -> MfAmcContentResponse:
    if not body.model_fields_set:
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    updated = await update_amc_content_admin(
        db,
        amc_id,
        admin_user_id=admin.id,
        marketing_name=body.marketing_name,
        description=body.description,
        website_url=body.website_url,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="AMC not found")
    await db.commit()
    return MfAmcContentResponse(**updated)


@router.get("/rules", response_model=MfCatalogRuleListResponse)
async def list_mf_catalog_rules(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfCatalogRuleListResponse:
    rules = await list_catalog_rules(db)
    return MfCatalogRuleListResponse(rules=[MfCatalogRuleResponse(**rule) for rule in rules])


@router.post("/rules", response_model=MfCatalogRuleResponse)
async def create_mf_catalog_rule(
    body: MfCreateCatalogRuleRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.rules.manage"))],
) -> MfCatalogRuleResponse:
    rule = await create_catalog_rule(
        db,
        admin_user_id=admin.id,
        name=body.name,
        description=body.description,
        priority=body.priority,
        enabled=body.enabled,
        conditions=body.conditions,
        actions=body.actions,
    )
    await db.commit()
    return MfCatalogRuleResponse(**rule)


@router.patch("/rules/{rule_id}", response_model=MfCatalogRuleResponse)
async def patch_mf_catalog_rule(
    rule_id: int,
    body: MfUpdateCatalogRuleRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.rules.manage"))],
) -> MfCatalogRuleResponse:
    if not body.model_fields_set:
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    updated = await update_catalog_rule(
        db,
        rule_id,
        admin_user_id=admin.id,
        name=body.name,
        description=body.description,
        priority=body.priority,
        enabled=body.enabled,
        conditions=body.conditions,
        actions=body.actions,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.commit()
    return MfCatalogRuleResponse(**updated)


@router.post("/rules/preview", response_model=MfCatalogRulesPreviewResponse)
async def preview_mf_catalog_rules(
    body: MfCatalogRulesPreviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfCatalogRulesPreviewResponse:
    preview = await preview_catalog_rules(db, rule_ids=body.rule_ids)
    return MfCatalogRulesPreviewResponse(**preview)


@router.post("/rules/apply", response_model=MfCatalogRulesPreviewResponse)
async def apply_mf_catalog_rules(
    body: MfCatalogRulesApplyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.publish"))],
) -> MfCatalogRulesPreviewResponse:
    if body.dry_run:
        preview = await preview_catalog_rules(db, rule_ids=body.rule_ids)
        return MfCatalogRulesPreviewResponse(**preview)

    preview = await preview_catalog_rules(db, rule_ids=body.rule_ids)
    settings = get_settings()
    if preview["affected_count"] > settings.zynd_mf_bulk_maker_checker_threshold:
        action = await create_admin_action_request(
            db,
            action_type=AdminActionType.mf_catalog_rules_apply,
            requester=admin,
            payload={"rule_ids": body.rule_ids},
            target_type="mf_catalog_rules",
            reason=body.reason,
        )
        await db.commit()
        return MfCatalogRulesPreviewResponse(
            affected_count=preview["affected_count"],
            items=preview["items"],
            rules=[MfCatalogRuleResponse(**rule) for rule in preview["rules"]],
            pending_action_id=str(action["id"]),
        )

    result = await apply_catalog_rules(
        db,
        admin_user_id=admin.id,
        rule_ids=body.rule_ids,
        dry_run=False,
    )
    await db.commit()
    rules = await list_catalog_rules(db)
    rule_map = {rule["id"]: rule for rule in rules}
    return MfCatalogRulesPreviewResponse(
        affected_count=result["affected_count"],
        items=result["items"],
        rules=[MfCatalogRuleResponse(**rule_map[r["id"]]) for r in preview["rules"] if r["id"] in rule_map],
        run_id=result.get("run_id"),
    )


@router.post("/funds/bulk/preview")
async def preview_mf_bulk_catalog(
    body: MfBulkCatalogPreviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> dict:
    return await preview_bulk_catalog(db, source_csv=body.csv)


@router.post("/funds/bulk", response_model=MfBulkCatalogJobResponse)
async def submit_mf_bulk_catalog(
    body: MfBulkCatalogSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.publish"))],
) -> MfBulkCatalogJobResponse:
    result = await create_bulk_catalog_job(
        db,
        admin_user_id=admin.id,
        source_csv=body.csv,
        dry_run=body.dry_run,
    )
    if result.get("requires_maker_checker"):
        action = await create_admin_action_request(
            db,
            action_type=AdminActionType.mf_catalog_bulk_apply,
            requester=admin,
            payload={"job_id": result["job_id"]},
            target_type="mf_bulk_catalog_job",
            reason=body.reason,
        )
        job = await db.get(MfBulkCatalogJob, uuid.UUID(str(result["job_id"])))
        if job:
            job.admin_action_id = action["id"]
        await db.commit()
        result["admin_action_id"] = str(action["id"])
    else:
        await db.commit()
    return MfBulkCatalogJobResponse(**result)


@router.get("/funds/bulk/jobs", response_model=MfBulkCatalogJobListResponse)
async def list_mf_bulk_catalog_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
    limit: int = Query(default=20, ge=1, le=100),
) -> MfBulkCatalogJobListResponse:
    jobs = await list_bulk_catalog_jobs(db, limit=limit)
    return MfBulkCatalogJobListResponse(jobs=[MfBulkCatalogJobResponse(**job) for job in jobs])


@router.get("/funds/bulk/jobs/{job_id}", response_model=MfBulkCatalogJobResponse)
async def get_mf_bulk_catalog_job(
    job_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfBulkCatalogJobResponse:
    job = await get_bulk_catalog_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Bulk job not found")
    return MfBulkCatalogJobResponse(**job)


@router.get("/jobs", response_model=MfJobListResponse)
async def list_mf_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.jobs.read"))],
) -> MfJobListResponse:
    jobs = await list_mf_jobs_with_status(db)
    return MfJobListResponse(jobs=[MfJobResponse(**job) for job in jobs])


@router.post("/jobs/{job_name}/run", response_model=MfRunJobResponse)
async def run_mf_job_admin(
    job_name: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.jobs.run"))],
    force: bool = Query(default=False, description="Skip dependency guard and cold-start threshold checks."),
) -> MfRunJobResponse:
    try:
        if job_name == "nav-cold-start-backfill":
            from app.application.mf.nav_cold_start_backfill_service import run_nav_cold_start_backfill

            result = await run_nav_cold_start_backfill(db, triggered_by="ADMIN", force=force)
        else:
            result = await trigger_mf_job(
                db,
                job_name,
                triggered_by="ADMIN",
                skip_dependency_check=force,
            )
        await db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return MfRunJobResponse(job=job_name, result=result, **result)


@router.get("/staging/batches", response_model=MfStagingBatchListResponse)
async def list_mf_staging_batches(
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> MfStagingBatchListResponse:
    batches = await list_scheme_staging_batches(limit=limit, status=status)
    return MfStagingBatchListResponse(
        batches=[MfStagingBatchResponse(**batch) for batch in batches]
    )


@router.get("/staging/batches/{batch_uuid}", response_model=MfStagingBatchResponse)
async def get_mf_staging_batch(
    batch_uuid: str,
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
) -> MfStagingBatchResponse:
    batch = await get_scheme_staging_batch(batch_uuid)
    if not batch:
        raise HTTPException(status_code=404, detail="Staging batch not found")
    return MfStagingBatchResponse(**batch)


@router.get("/staging/batches/{batch_uuid}/rows", response_model=MfStagingRowListResponse)
async def list_mf_staging_batch_rows(
    batch_uuid: str,
    _: Annotated[object, Depends(require_permission("mf.catalog.read"))],
    validation_status: Optional[str] = Query(default=None),
    promote_status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> MfStagingRowListResponse:
    try:
        payload = await list_scheme_staging_batch_rows(
            batch_uuid,
            validation_status=validation_status,
            promote_status=promote_status,
            page=page,
            page_size=page_size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MfStagingRowListResponse(
        items=[MfStagingRowResponse(**item) for item in payload["items"]],
        page=payload["page"],
        page_size=payload["page_size"],
        total=payload["total"],
        has_more=payload["has_more"],
    )


@router.post("/staging/batches/{batch_uuid}/approve", response_model=MfStagingBatchResponse)
async def approve_mf_staging_batch(
    batch_uuid: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.publish"))],
) -> MfStagingBatchResponse:
    try:
        batch = await approve_scheme_staging_batch(batch_uuid, admin_user_id=admin.id)
        await db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MfStagingBatchResponse(**batch)


@router.post("/staging/batches/{batch_uuid}/reject", response_model=MfStagingBatchResponse)
async def reject_mf_staging_batch(
    batch_uuid: str,
    body: MfStagingRejectRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.catalog.publish"))],
) -> MfStagingBatchResponse:
    try:
        batch = await reject_scheme_staging_batch(
            batch_uuid,
            admin_user_id=admin.id,
            reason=body.reason,
        )
        await db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MfStagingBatchResponse(**batch)


@router.post("/staging/batches/{batch_uuid}/promote", response_model=MfRunJobResponse)
async def promote_mf_staging_batch(
    batch_uuid: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.catalog.publish"))],
) -> MfRunJobResponse:
    try:
        result = await run_cybrilla_scheme_promote(
            db,
            triggered_by="ADMIN",
            batch_uuid=batch_uuid,
            force=True,
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return MfRunJobResponse(job="cybrilla-scheme-promote", result=result, **result)


@router.get("/ingestion-runs", response_model=MfIngestionRunListResponse)
async def list_mf_ingestion_runs_admin(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.jobs.read"))],
    job_name: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> MfIngestionRunListResponse:
    runs = await list_mf_ingestion_runs(db, job_name=job_name, limit=limit)
    return MfIngestionRunListResponse(runs=[MfIngestionRunResponse(**run) for run in runs])


@router.get("/metrics", response_class=PlainTextResponse)
async def mf_prometheus_metrics(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.jobs.read"))],
) -> PlainTextResponse:
    body = await get_mf_prometheus_metrics(db)
    return PlainTextResponse(body, media_type="text/plain; version=0.0.4; charset=utf-8")


@router.get("/amcs", response_model=MfAmcListResponse)
async def list_mf_amcs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("mf.amcs.read"))],
) -> MfAmcListResponse:
    amcs = await list_amcs_admin(db)
    return MfAmcListResponse(amcs=[MfAmcResponse(**item) for item in amcs])


@router.patch("/amcs/{amc_id}", response_model=MfAmcResponse)
async def update_mf_amc(
    amc_id: int,
    body: MfUpdateAmcRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.amcs.manage"))],
) -> MfAmcResponse:
    if (
        body.is_active is None
        and body.amc_code is None
        and body.admin_kill_switch is None
    ):
        raise HTTPException(
            status_code=400,
            detail="Provide is_active, amc_code, and/or admin_kill_switch",
        )
    try:
        updated = await update_amc_catalog_admin(
            db,
            amc_id,
            admin_user_id=admin.id,
            is_active=body.is_active,
            amc_code=body.amc_code,
            admin_kill_switch=body.admin_kill_switch,
            reason=body.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not updated:
        raise HTTPException(status_code=404, detail="AMC not found")
    await db.commit()
    return MfAmcResponse(**updated)
