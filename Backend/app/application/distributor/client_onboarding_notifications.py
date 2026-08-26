from __future__ import annotations

from app.application.ports.email_gateway import send_security_email
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.password_reset_token_store import create_reset_token


async def send_investor_set_password_email(user: User, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    token = await create_reset_token(str(user.id))
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    await send_security_email(
        to_email=user.email,
        subject="Set your Zynd password",
        body=(
            "Your Zynd investing account has been created by your Zynd Mitra.\n\n"
            "Set your password using the link below (valid for a short time):\n"
            f"{reset_url}\n\n"
            "After setting your password, sign in to the Zynd app or web to complete KYC and start investing."
        ),
    )
