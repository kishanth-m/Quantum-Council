"""
backend/app/database/models.py

SQLAlchemy ORM models — each class maps to a database table.

Design principles:
  - All primary keys are UUIDs (not auto-increment integers).
    Reason: safer for future multi-user / distributed deployments.
  - All timestamps use UTC.
  - Sensitive data (API keys) is NEVER stored in plain text columns here.
    The secrets_manager module handles encrypted credential storage separately.
  - Every record that belongs to a user has a user_id foreign key,
    ensuring users cannot access each other's data.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base


def utcnow() -> datetime:
    """Return the current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    """Generate a new UUID4 string."""
    return str(uuid.uuid4())


# ─── User ──────────────────────────────────────────────────────────────────────
class User(Base):
    """
    Stores registered user accounts.
    Passwords are NEVER stored in plain text — only bcrypt hashes.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    sessions: Mapped[list["CouncilSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    agent_configs: Mapped[list["AgentConfig"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    privacy_settings: Mapped["PrivacySettings | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


# ─── Council Session ───────────────────────────────────────────────────────────
class CouncilSession(Base):
    """
    One council session = one task submitted by the user.
    Tracks which mode was used and the overall execution status.
    """

    __tablename__ = "council_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(256), default="Untitled Session")
    task: Mapped[str] = mapped_column(Text, nullable=False)
    # Mode: individual | parallel | council
    mode: Mapped[str] = mapped_column(String(32), nullable=False, default="council")
    # Status: pending | running | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    final_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_rounds: Mapped[int] = mapped_column(Integer, default=0)
    total_model_calls: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    execution_time_ms: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="sessions")
    messages: Mapped[list["AgentMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    execution_events: Mapped[list["ExecutionEvent"]] = relationship(back_populates="session", cascade="all, delete-orphan")


# ─── Agent Message ─────────────────────────────────────────────────────────────
class AgentMessage(Base):
    """
    A single message produced by an agent during a council session.
    Includes reply-to threading so we can reconstruct the conversation graph.
    """

    __tablename__ = "agent_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("council_sessions.id", ondelete="CASCADE"), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. "researcher"
    agent_name: Mapped[str] = mapped_column(String(64), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Types: proposal | question | agreement | disagreement | counterargument
    #        critique | revision | evidence | final_decision
    message_type: Mapped[str] = mapped_column(String(32), nullable=False, default="proposal")
    round_number: Mapped[int] = mapped_column(Integer, default=1)
    reply_to_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    model_id: Mapped[str] = mapped_column(String(128), nullable=False, default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)

    # Relationship
    session: Mapped["CouncilSession"] = relationship(back_populates="messages")


# ─── Agent Configuration ───────────────────────────────────────────────────────
class AgentConfig(Base):
    """
    Per-user, per-agent configuration.
    Users can customise system prompts, model assignments, and parameters.
    Default configs are seeded at user creation time.
    """

    __tablename__ = "agent_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Agent identifier: researcher | analyst | alternative | critic | specialist
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(64), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    personality: Mapped[str] = mapped_column(Text, default="")
    # Provider: ollama | groq | openai_compatible
    provider: Mapped[str] = mapped_column(String(32), default="ollama")
    model_name: Mapped[str] = mapped_column(String(128), default="llama3.2:1b")
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    max_tokens: Mapped[int] = mapped_column(Integer, default=1024)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=120)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationship
    user: Mapped["User"] = relationship(back_populates="agent_configs")


# ─── Document ──────────────────────────────────────────────────────────────────
class Document(Base):
    """
    Metadata for an uploaded PDF or other document.
    The actual file content is stored on disk (not in the database).
    Chunks and embeddings are stored in ChromaDB separately.
    """

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    collection_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("document_collections.id", ondelete="SET NULL"), nullable=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    # Status: uploading | processing | indexed | failed | deleted
    status: Mapped[str] = mapped_column(String(32), default="uploading")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="documents")
    collection: Mapped["DocumentCollection | None"] = relationship(back_populates="documents")


# ─── Document Collection ───────────────────────────────────────────────────────
class DocumentCollection(Base):
    """
    Groups related documents together (e.g. "Project Reports", "Research Papers").
    """

    __tablename__ = "document_collections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationship
    documents: Mapped[list["Document"]] = relationship(back_populates="collection")


# ─── Document Chunk ───────────────────────────────────────────────────────────
class DocumentChunk(Base):
    """
    Persistent chunk storage for Knowledge Vault RAG.
    Maintains exact document linkage, page number, chunk order, and vector representations.
    """

    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    page_number: Mapped[int] = mapped_column(Integer, default=1)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    vector_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationship
    document: Mapped["Document"] = relationship("Document", backref="chunks")


# ─── Execution Event ───────────────────────────────────────────────────────────
class ExecutionEvent(Base):
    """
    Fine-grained log of what happened during a council session.
    These events are streamed to the frontend in real time via WebSocket/SSE.
    They are also stored here for session replay.

    Event types (from spec):
        session_started | agent_started | agent_thinking | agent_message
        agent_reply | agent_agreed | agent_disagreed | agent_criticised
        agent_revision | agent_completed | council_decision
        session_completed | session_failed | session_cancelled
    """

    __tablename__ = "execution_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("council_sessions.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationship
    session: Mapped["CouncilSession"] = relationship(back_populates="execution_events")


# ─── Privacy Settings ──────────────────────────────────────────────────────────
class PrivacySettings(Base):
    """
    Per-user privacy configuration.
    One row per user — created with defaults on registration.
    """

    __tablename__ = "privacy_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    # privacy_mode: local_only | hybrid
    privacy_mode: Mapped[str] = mapped_column(String(32), default="local_only")
    allow_online_llm: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_cloud_documents: Mapped[bool] = mapped_column(Boolean, default=False)
    require_consent_before_external: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationship
    user: Mapped["User"] = relationship(back_populates="privacy_settings")


# ─── Provider Configuration ───────────────────────────────────────────────────
class ProviderConfig(Base):
    """
    Stores credentials and model settings for LLM providers (Groq, OpenAI, Ollama, etc.).
    API keys are stored encrypted using Fernet derived from the application secret key.
    """

    __tablename__ = "provider_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), default="default_user")
    provider: Mapped[str] = mapped_column(String(32), nullable=False)  # ollama | groq | openai | openai_compatible
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    encrypted_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


# ─── Individual Agent Conversations ───────────────────────────────────────────
class Conversation(Base):
    """
    Independent conversation thread for an individual AI agent.
    Maintains isolated conversation history and context separate from Council sessions.
    """

    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), default="default_user")
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False)  # researcher, analyst, etc.
    title: Mapped[str] = mapped_column(String(256), default="New Conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    messages: Mapped[list["ConversationMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class ConversationMessage(Base):
    """
    A single turn (user prompt or agent reply) in an individual agent conversation.
    """

    __tablename__ = "conversation_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender: Mapped[str] = mapped_column(String(16), nullable=False)  # user | agent
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationship
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


