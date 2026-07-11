from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel

from app.domain.shared.events import DomainEvent

T = TypeVar("T", bound=BaseModel)


def build_domain_event(
    *,
    event_type: str,
    aggregate_id: str,
    aggregate_type: str,
    payload: BaseModel | dict[str, Any],
    schema_version: int = 1,
    correlation_id: str | None = None,
    causation_id: str | None = None,
) -> DomainEvent:
    serialized = payload.model_dump(mode="json") if isinstance(payload, BaseModel) else payload
    return DomainEvent(
        event_type=event_type,
        schema_version=schema_version,
        correlation_id=correlation_id,
        causation_id=causation_id,
        aggregate_id=aggregate_id,
        aggregate_type=aggregate_type,
        payload=serialized,
    )


def parse_event_payload(event: DomainEvent, model: type[T]) -> T:
    return model.model_validate(event.payload)
