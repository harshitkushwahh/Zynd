"""Notify investors when their Mitra sends a quick transaction recommendation."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.infrastructure.persistence.mitra_txn_recommendation_models import (
    MitraTxnInvestmentType,
    MitraTxnRecommendation,
    MitraTxnRecommendationItem,
)
from app.infrastructure.persistence.models import User


async def notify_client_mitra_txn_recommendation(
    db: AsyncSession,
    *,
    recommendation: MitraTxnRecommendation,
    items: list[MitraTxnRecommendationItem],
    client_user: User,
    link: str,
) -> None:
    txn_label = "SIP" if recommendation.investment_type == MitraTxnInvestmentType.sip else "One time"
    amount_text = f"₹{float(recommendation.amount_inr):,.2f}"
    fund_label = items[0].fund_name if len(items) == 1 else f"{len(items)} funds"
    schedule_user_notification(
        user_id=client_user.id,
        user_email=client_user.email,
        notification_type=NotificationType.INVEST_MITRA_TXN_RECOMMENDATION,
        title="Investment recommendation from your Mitra",
        body=(
            f"Your Zynd Mitra recommended a {txn_label.lower()} investment of {amount_text} "
            f"across {fund_label}.\n"
            f"Open the link to review and complete your investment."
        ),
        metadata={
            "recommendation_token": recommendation.token,
            "product_id": str(items[0].product_id) if items else str(recommendation.product_id),
            "fund_name": fund_label,
            "item_count": str(len(items)),
            "investment_type": recommendation.investment_type.value,
            "amount_inr": str(recommendation.amount_inr),
            "link": link,
        },
        idempotency_key=f"invest.mitra_txn_recommendation:{recommendation.id}",
        email_subject="Your Mitra recommended a mutual fund investment on Zynd",
    )
