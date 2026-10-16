from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SupportConversation(Base):
    __tablename__ = "support_conversations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'escalated', 'closed')",
            name="ck_support_conversations_status",
        ),
        CheckConstraint(
            "handler IN ('bot', 'human')",
            name="ck_support_conversations_handler",
        ),
        Index(
            "uq_support_conversations_active_user",
            "user_id",
            unique=True,
            postgresql_where=text("status <> 'closed'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    handler: Mapped[str] = mapped_column(String(16), nullable=False, default="bot")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    messages: Mapped[list["SupportMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="SupportMessage.created_at",
    )
    ticket: Mapped[Optional["SupportTicket"]] = relationship(
        back_populates="conversation",
        uselist=False,
    )


class SupportMessage(Base):
    __tablename__ = "support_messages"
    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'bot', 'agent', 'system')",
            name="ck_support_messages_role",
        ),
        CheckConstraint(
            "visibility IN ('customer', 'internal')",
            name="ck_support_messages_visibility",
        ),
        CheckConstraint(
            "kind IN ('text', 'resolution_prompt')",
            name="ck_support_messages_kind",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("support_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="customer")
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="text", server_default="text")
    sender_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    attachment_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    conversation: Mapped[SupportConversation] = relationship(back_populates="messages")


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'pending', 'resolved')",
            name="ck_support_tickets_status",
        ),
        CheckConstraint(
            "priority IN ('low', 'medium', 'high')",
            name="ck_support_tickets_priority",
        ),
        CheckConstraint(
            "topic IN ('kyc', 'payment', 'family', 'goals', 'portfolio', 'account', 'referrals', 'other')",
            name="ck_support_tickets_topic",
        ),
        CheckConstraint(
            "handled_by IN ('bot', 'human')",
            name="ck_support_tickets_handled_by",
        ),
        CheckConstraint("channel IN ('web_chat', 'email')", name="ck_support_tickets_channel"),
        CheckConstraint(
            "resolution_choice IS NULL OR resolution_choice IN ('yes', 'no', 'auto')",
            name="ck_support_tickets_resolution_choice",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("support_conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    topic: Mapped[str] = mapped_column(String(32), nullable=False, default="other", index=True)
    topics: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open", index=True)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    channel: Mapped[str] = mapped_column(String(16), nullable=False, default="web_chat")
    handled_by: Mapped[str] = mapped_column(String(16), nullable=False, default="bot", index=True)
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    escalation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    first_response_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    first_responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_prompted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_choice: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    conversation: Mapped[SupportConversation] = relationship(back_populates="ticket")


class SupportResolutionExample(Base):
    __tablename__ = "support_resolution_examples"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("support_tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    topic: Mapped[str] = mapped_column(String(32), nullable=False, default="other")
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    search_vector: Mapped[Optional[str]] = mapped_column(
        TSVECTOR,
        Computed(
            "to_tsvector('english', coalesce(question, '') || ' ' || coalesce(answer, ''))",
            persisted=True,
        ),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
