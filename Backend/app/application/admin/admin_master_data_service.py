from __future__ import annotations

from app.application.master_data.finprim_reference_service import (
    list_admin_states,
    lookup_pincode_admin,
    resolve_state_code_for_name,
)

__all__ = [
    "list_admin_states",
    "lookup_admin_pincode",
    "resolve_state_code_for_name",
]


async def lookup_admin_pincode(pincode: str) -> dict[str, str]:
    return await lookup_pincode_admin(pincode)
