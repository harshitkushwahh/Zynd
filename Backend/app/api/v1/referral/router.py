from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, get_current_user
from app.api.v1.referral.schemas import (
    ReferralClickRequest,
    ReferralClickResponse,
    ReferralLeaderboardCurrentUserResponse,
    ReferralLeaderboardEntryResponse,
    ReferralLeaderboardPeriod,
    ReferralLeaderboardResponse,
    ReferralListItemResponse,
    ReferralListResponse,
    ReferralMeResponse,
)
from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.application.referral.referral_attribution_service import (
    count_engaged_for_referrer,
    count_first_investment_for_referrer,
    count_kyc_verified_for_referrer,
    count_qualified_for_referrer,
    count_signups_for_referrer,
    list_referrals_for_referrer,
    mask_referee_email,
)
from app.application.referral.referral_click_service import record_referral_click
from app.application.referral.referral_code_service import (
    count_referral_clicks_for_user,
    get_or_create_referral_code,
    normalize_referral_code,
)
from app.application.referral.referral_errors import ReferralError
from app.application.referral.referral_leaderboard_service import (
    ReferralLeaderboardPeriod as LeaderboardPeriodEnum,
    get_referral_leaderboard,
    referee_display_name_for_user,
)
from app.application.referral.referral_qr_service import (
    REFERRAL_QR_TEMPLATE_VERSION,
    generate_referral_qr_png,
)
from app.core.config import get_settings
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/referrals", tags=["referrals"])


def _share_url(code: str) -> str:
    settings = get_settings()
    base = settings.frontend_url.rstrip("/")
    return f"{base}/r/{code}"


def _handle_referral_error(exc: ReferralError) -> JSONResponse:
    payload: dict[str, object] = {"code": exc.code, "message": exc.message}
    if exc.status_code == 429:
        payload["retry_after_seconds"] = 60
    return JSONResponse(status_code=exc.status_code, content={"detail": payload})


@router.get("/me", response_model=ReferralMeResponse)
async def get_referral_me(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReferralMeResponse:
    referral_code = await get_or_create_referral_code(db, user=current_user)
    click_count = await count_referral_clicks_for_user(db, user_id=current_user.id)
    signup_count = await count_signups_for_referrer(db, referrer_user_id=current_user.id)
    kyc_verified_count = await count_kyc_verified_for_referrer(
        db, referrer_user_id=current_user.id
    )
    first_investment_count = await count_first_investment_for_referrer(
        db, referrer_user_id=current_user.id
    )
    qualified_count = await count_qualified_for_referrer(db, referrer_user_id=current_user.id)
    engaged_count = await count_engaged_for_referrer(db, referrer_user_id=current_user.id)
    await db.commit()
    return ReferralMeResponse(
        code=referral_code.code,
        share_url=_share_url(referral_code.code),
        click_count=click_count,
        signup_count=signup_count,
        kyc_verified_count=kyc_verified_count,
        first_investment_count=first_investment_count,
        qualified_count=qualified_count,
        engaged_count=engaged_count,
        created_at=referral_code.created_at,
    )


@router.get("/me/qr")
async def get_referral_qr(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    size: Annotated[int, Query(ge=256, le=1024)] = 512,
) -> Response:
    referral_code = await get_or_create_referral_code(db, user=current_user)
    await db.commit()
    png_bytes = generate_referral_qr_png(_share_url(referral_code.code), size=size)
    filename = f"zynd-referral-{referral_code.code}.png"
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
            "X-QR-Template-Version": str(REFERRAL_QR_TEMPLATE_VERSION),
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


@router.get("/referrals", response_model=ReferralListResponse)
async def get_referral_list(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReferralListResponse:
    rows = await list_referrals_for_referrer(db, referrer_user_id=current_user.id)
    referee_ids = [referee.id for _, referee in rows]
    profile_image_urls = await resolve_profile_image_urls_by_user_id(db, referee_ids)
    items = [
        ReferralListItemResponse(
            id=str(attribution.id),
            name=referee_display_name_for_user(referee),
            masked_email=mask_referee_email(referee.email),
            current_stage=attribution.current_stage.value,
            signup_channel=attribution.signup_channel.value,
            signed_up_at=attribution.signed_up_at,
            kyc_verified_at=attribution.kyc_verified_at,
            first_investment_at=attribution.first_investment_at,
            first_investment_product=(
                attribution.first_investment_product.value
                if attribution.first_investment_product is not None
                else None
            ),
            first_investment_amount_inr=attribution.first_investment_amount_inr,
            qualified_at=attribution.qualified_at,
            engaged_at=attribution.engaged_at,
            profile_image_url=profile_image_urls.get(referee.id),
        )
        for attribution, referee in rows
    ]
    return ReferralListResponse(items=items)


@router.get("/leaderboard", response_model=ReferralLeaderboardResponse)
async def get_referral_leaderboard_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    period: ReferralLeaderboardPeriod = Query(default="this_month"),
) -> ReferralLeaderboardResponse:
    entries, current_user_stats = await get_referral_leaderboard(
        db,
        current_user_id=current_user.id,
        period=LeaderboardPeriodEnum(period),
    )
    return ReferralLeaderboardResponse(
        period=period,
        entries=[
            ReferralLeaderboardEntryResponse(
                rank=entry.rank,
                name=entry.name,
                referral_count=entry.referral_count,
                earnings_inr=entry.earnings_inr,
                is_current_user=entry.is_current_user,
                profile_image_url=entry.profile_image_url,
            )
            for entry in entries
        ],
        current_user=ReferralLeaderboardCurrentUserResponse(
            rank=current_user_stats.rank,
            referral_count=current_user_stats.referral_count,
            earnings_inr=current_user_stats.earnings_inr,
            top_percent=current_user_stats.top_percent,
        ),
    )


@router.post("/clicks", response_model=ReferralClickResponse)
async def post_referral_click(
    body: ReferralClickRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReferralClickResponse | JSONResponse:
    normalized = normalize_referral_code(body.code)
    if not normalized:
        return _handle_referral_error(
            ReferralError("Referral link is invalid or inactive.", "invalid_referral_code", 404)
        )

    try:
        await record_referral_click(
            db,
            code=normalized,
            ip=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
    except ReferralError as exc:
        return _handle_referral_error(exc)

    return ReferralClickResponse(ok=True, code=normalized, share_path=f"/r/{normalized}")
