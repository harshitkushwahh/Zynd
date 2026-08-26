from __future__ import annotations

from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.api.v1.auth.deps import require_admin_user
from app.application.referral.referral_qr_service import (
    REFERRAL_QR_TEMPLATE_VERSION,
    generate_referral_qr_png,
)
from app.infrastructure.persistence.models import User

router = APIRouter(tags=["admin-product"])


def _validate_qr_target(data: str) -> str:
    normalized = data.strip()
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_qr_target",
                "message": "QR target must be a valid http or https URL.",
            },
        )
    return normalized


@router.get("/product/qr")
async def get_product_qr(
    _: Annotated[User, Depends(require_admin_user)],
    data: Annotated[str, Query(min_length=1, max_length=2048)],
    size: Annotated[int, Query(ge=168, le=1024)] = 512,
) -> Response:
    target = _validate_qr_target(data)
    png_bytes = generate_referral_qr_png(target, size=size)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
            "X-QR-Template-Version": str(REFERRAL_QR_TEMPLATE_VERSION),
            "Content-Disposition": 'inline; filename="zynd-product-qr.png"',
        },
    )
