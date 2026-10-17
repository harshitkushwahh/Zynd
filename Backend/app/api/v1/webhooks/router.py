from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_webhook_service import process_finprim_webhook
from app.application.support.realtime.publisher import publish_support_realtime_event
from app.application.support.webhook_dispatcher import verify_inbound_support_webhook_signature
from app.core.database import get_db

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/support-events")
async def support_events_webhook(request: Request) -> dict:
    raw_body = await request.body()
    signature_header = request.headers.get("X-Zynd-Signature")
    if not verify_inbound_support_webhook_signature(
        raw_body=raw_body,
        signature_header=signature_header,
    ):
        raise HTTPException(status_code=401, detail="Invalid support webhook signature")
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be a JSON object")
    event_type = payload.get("type")
    if isinstance(event_type, str) and event_type:
        await publish_support_realtime_event(payload)
    return {"ok": True}


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
