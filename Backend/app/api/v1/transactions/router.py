from __future__ import annotations

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.api.v1.auth.deps import get_client_ip, require_fund_eligible_user
from app.core.database import get_db
from app.application.referral.referral_investment_service import record_referral_investment_activity
from app.infrastructure.persistence.models import AuditEventType, AuditLog, User
from app.infrastructure.persistence.referral_models import ReferralInvestmentProduct
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/transactions", tags=["transactions"])


class TransferRequest(BaseModel):
    amount_inr: int = Field(gt=0, le=10_000_000)
    destination_label: str = Field(min_length=2, max_length=120)
    note: str | None = Field(default=None, max_length=240)


class TransferResponse(BaseModel):
    transfer_id: str
    status: str
    amount_inr: int
    destination_label: str
    message: str


@router.post("/transfer", response_model=TransferResponse)
async def post_transfer(
    body: TransferRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_fund_eligible_user)],
) -> TransferResponse:
    transfer_id = str(uuid4())
    db.add(
        AuditLog(
            user_id=current_user.id,
            event_type=AuditEventType.transfer_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "transfer_id": transfer_id,
                "amount_inr": body.amount_inr,
                "destination_label": body.destination_label,
                "note": body.note,
            },
        )
    )
    await db.flush()
    await record_referral_investment_activity(
        db,
        user=current_user,
        product=ReferralInvestmentProduct.other,
        amount_inr=body.amount_inr,
    )
    return TransferResponse(
        transfer_id=transfer_id,
        status="accepted_stub",
        amount_inr=body.amount_inr,
        destination_label=body.destination_label,
        message="Transfer accepted by Sprint 4 stub endpoint. Settlement wiring comes in a later sprint.",
    )
