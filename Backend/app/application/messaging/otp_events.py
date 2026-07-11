from __future__ import annotations

from app.application.identity.otp_purposes import OtpChannel, OtpPurpose
from app.application.messaging.scheduled_events import schedule_domain_event
from app.application.messaging.streams import STREAM_AUTH
from app.domain.account.events import OtpRequestedPayload, otp_requested_event


def schedule_otp_requested(
    *,
    purpose: OtpPurpose,
    identifier: str,
    destination: str,
    storage_key: str,
    channel: OtpChannel,
) -> None:
    schedule_domain_event(
        STREAM_AUTH,
        otp_requested_event(
            OtpRequestedPayload(
                purpose=purpose,
                identifier=identifier,
                destination=destination,
                storage_key=storage_key,
                channel=channel,
            )
        ),
    )
