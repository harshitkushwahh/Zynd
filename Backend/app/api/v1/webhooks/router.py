from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_webhook_service import process_finprim_webhook
from app.core.database import get_db

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/finprim")
async def finprim_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    raw_body = await request.body()
    signature_header = request.headers.get("FP-Signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be a JSON object")

    try:
        result = await process_finprim_webhook(
            db,
            raw_body=raw_body,
            signature_header=signature_header,
            payload=payload,
        )
        await db.commit()
        return result
    except PermissionError as exc:
        await db.rollback()
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        await db.rollback()
        raise
