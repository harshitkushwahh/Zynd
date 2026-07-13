from fastapi import APIRouter

from app.api.v1 import health
from app.api.v1.admin.router import router as admin_router
from app.api.v1.auth.router import router as auth_router
from app.api.v1.documents.router import router as documents_router
from app.api.v1.invest.router import router as invest_router
from app.api.v1.kyc.router import router as kyc_router
from app.api.v1.notifications.router import router as notifications_router
from app.api.v1.referral.router import router as referral_router
from app.api.v1.transactions.router import router as transactions_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(transactions_router)
api_router.include_router(documents_router)
api_router.include_router(kyc_router)
api_router.include_router(invest_router)
api_router.include_router(notifications_router)
api_router.include_router(referral_router)
