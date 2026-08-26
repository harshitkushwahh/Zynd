from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.v1.auth.deps import require_any_permission
from app.application.admin.admin_master_data_service import list_admin_states, lookup_admin_pincode
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/master-data", tags=["admin-master-data"])

ADMIN_MASTER_DATA_READ = require_any_permission(
    "admin.distributor_hierarchy.read",
    "admin.distributor_branches.manage",
    "admin.distributor_branches.list",
    "admin.distributor_managers.list",
    "admin.distributor_partners.list",
)


class AdminPincodeResponse(BaseModel):
    code: str
    city: str
    district: str
    state_name: str
    state_code: str
    country_ansi_code: str


class AdminStateResponse(BaseModel):
    state_name: str
    state_code: str


@router.get("/states", response_model=list[AdminStateResponse])
async def list_admin_states_route(
    _: Annotated[User, Depends(ADMIN_MASTER_DATA_READ)],
) -> list[AdminStateResponse]:
    items = await list_admin_states()
    return [AdminStateResponse(**item) for item in items]


@router.get("/pincode/{pincode}", response_model=AdminPincodeResponse)
async def get_admin_pincode(
    pincode: str,
    _: Annotated[User, Depends(ADMIN_MASTER_DATA_READ)],
) -> AdminPincodeResponse:
    if not pincode.isdigit() or len(pincode) != 6:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_pincode", "message": "Invalid pincode."},
        )

    try:
        payload = await lookup_admin_pincode(pincode)
    except FpClientError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc

    if not payload.get("state_code"):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "state_not_resolved",
                "message": "Could not resolve state code for this pincode.",
            },
        )

    return AdminPincodeResponse(**payload)
