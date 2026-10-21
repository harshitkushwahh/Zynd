from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.mf.bank_accounts_router import router as bank_accounts_router
from app.api.v1.mf.funds_router import router as funds_router
from app.api.v1.mf.mandates_router import router as mandates_router
from app.api.v1.mf.orders_router import router as orders_router
from app.api.v1.mf.payment_router import router as payment_router
from app.api.v1.mf.portfolio_router import router as portfolio_router
from app.api.v1.mf.recommendations_router import router as recommendations_router
from app.api.v1.mf.risk_profile_router import router as risk_profile_router
from app.api.v1.mf.sip_router import router as sip_router
from app.api.v1.mf.txn_recommendations_router import router as txn_recommendations_router

router = APIRouter(prefix="/invest", tags=["invest"])

router.include_router(funds_router)
router.include_router(orders_router)
router.include_router(payment_router)
router.include_router(mandates_router)
router.include_router(sip_router)
router.include_router(portfolio_router)
router.include_router(bank_accounts_router)
router.include_router(risk_profile_router)
router.include_router(txn_recommendations_router)
router.include_router(recommendations_router, prefix="/recommendations", tags=["recommendations"])
