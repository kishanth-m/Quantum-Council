"""
backend/app/core/schemas.py

Pydantic schemas for request validation and response serialisation.

The distinction between schemas and database models:
  - Database models (database/models.py): describe how data is STORED in SQLite.
  - Pydantic schemas (this file): describe what data looks like in API requests/responses.

This separation means:
  - We never accidentally expose internal fields (like hashed_password) in responses.
  - We can validate incoming data before it ever touches the database.
  - The API contract is independent of the database schema.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ─── Shared base ───────────────────────────────────────────────────────────────
class TimestampMixin(BaseModel):
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Health ────────────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    database: str
    ollama: str
    privacy_mode: str
    timestamp: datetime


# ─── Auth ──────────────────────────────────────────────────────────────────────
class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v


class UserLoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Agent ─────────────────────────────────────────────────────────────────────
class AgentConfigResponse(BaseModel):
    id: str
    agent_id: str
    agent_name: str
    personality: str
    provider: str
    model_name: str
    temperature: float
    max_tokens: int
    timeout_seconds: int
    is_enabled: bool
    # NOTE: system_prompt is included for the Agent Studio page.
    # It is never included in messages or logs.
    system_prompt: str
    model_config = ConfigDict(from_attributes=True)


class AgentConfigUpdateRequest(BaseModel):
    system_prompt: str | None = None
    personality: str | None = None
    provider: str | None = None
    model_name: str | None = None
    temperature: float | None = Field(None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(None, ge=64, le=8192)
    timeout_seconds: int | None = Field(None, ge=10, le=300)
    is_enabled: bool | None = None


# ─── Resilience & Recovery ───────────────────────────────────────────────────
class ResilienceConfigSchema(BaseModel):
    auto_recovery_enabled: bool = True
    max_retries: int = 2
    agent_timeout_seconds: float = 30.0
    allow_role_substitution: bool = True
    min_healthy_agents: int = 1
    allow_partial_completion: bool = True


class ResilienceConfigUpdateSchema(BaseModel):
    auto_recovery_enabled: bool | None = None
    max_retries: int | None = Field(None, ge=0, le=5)
    agent_timeout_seconds: float | None = Field(None, ge=5.0, le=300.0)
    allow_role_substitution: bool | None = None
    min_healthy_agents: int | None = Field(None, ge=1, le=5)
    allow_partial_completion: bool | None = None


class CouncilSessionDetailResponse(BaseModel):
    id: str
    task: str
    mode: str
    status: str
    healthy_agents: list[str] = []
    failed_agents: list[str] = []
    agent_statuses: dict[str, str] = {}
    agent_outputs: dict[str, str] = {}
    agent_failures: dict[str, Any] = {}
    reassigned_tasks: list[dict[str, Any]] = []
    substitute_outputs: dict[str, Any] = {}
    quality_assessment: dict[str, Any] = {}
    final_synthesis: str | None = None
    error: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
class StartSessionRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=4096)
    mode: str = Field("council", pattern=r"^(individual|parallel|council)$")
    # Optional: which agent to use in individual mode
    agent_id: str | None = None
    # Optional: which document collection to include in context
    collection_id: str | None = None
    # Optional: maximum number of council rounds (overrides server default)
    max_rounds: int | None = Field(None, ge=1, le=5)


class SessionResponse(BaseModel):
    id: str
    title: str
    task: str
    mode: str
    status: str
    created_at: datetime
    completed_at: datetime | None
    final_answer: str | None
    total_rounds: int
    total_model_calls: int
    execution_time_ms: int
    model_config = ConfigDict(from_attributes=True)


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]
    total: int
    page: int
    page_size: int


# ─── Agent Message ─────────────────────────────────────────────────────────────
class AgentMessageResponse(BaseModel):
    id: str
    session_id: str
    agent_id: str
    agent_name: str
    content: str
    message_type: str
    round_number: int
    reply_to_id: str | None
    model_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Execution Events (streamed via SSE/WebSocket) ─────────────────────────────
class ExecutionEvent(BaseModel):
    """
    Structured event streamed to the frontend during council execution.
    The frontend uses these to:
      - Animate avatar states (thinking, speaking, listening…)
      - Update the live transcript
      - Show progress indicators
    """

    event_type: str
    session_id: str
    agent_id: str | None = None
    agent_name: str | None = None
    data: dict[str, Any] = {}
    timestamp: datetime


# ─── Model / Provider ──────────────────────────────────────────────────────────
class OllamaTestRequest(BaseModel):
    base_url: str = "http://127.0.0.1:11434"
    model_name: str


class ProviderTestRequest(BaseModel):
    provider: str = Field(..., pattern=r"^(ollama|groq|openai_compatible)$")
    model_name: str
    base_url: str | None = None
    # Note: api_key is accepted here but NEVER stored or logged.
    # It is used only for the connection test and then discarded.
    api_key: str | None = None


class ProviderTestResponse(BaseModel):
    success: bool
    provider: str
    model_name: str
    message: str
    latency_ms: int | None = None


class ModelStatusResponse(BaseModel):
    provider: str
    model_name: str
    status: str  # available | unavailable | unknown
    base_url: str | None


# ─── Document ──────────────────────────────────────────────────────────────────
class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_size_bytes: int
    page_count: int
    chunk_count: int
    status: str
    uploaded_at: datetime
    indexed_at: datetime | None
    collection_id: str | None
    model_config = ConfigDict(from_attributes=True)


class DocumentCollectionResponse(BaseModel):
    id: str
    name: str
    description: str
    created_at: datetime
    document_count: int = 0
    model_config = ConfigDict(from_attributes=True)


# ─── Privacy ───────────────────────────────────────────────────────────────────
class PrivacySettingsResponse(BaseModel):
    privacy_mode: str
    allow_online_llm: bool
    allow_cloud_documents: bool
    require_consent_before_external: bool
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PrivacySettingsUpdateRequest(BaseModel):
    privacy_mode: str | None = Field(None, pattern=r"^(local_only|hybrid)$")
    allow_online_llm: bool | None = None
    allow_cloud_documents: bool | None = None
    require_consent_before_external: bool | None = None


# ─── Analytics ─────────────────────────────────────────────────────────────────
class AnalyticsSummaryResponse(BaseModel):
    total_sessions: int
    completed_sessions: int
    failed_sessions: int
    total_model_calls: int
    total_tokens_used: int
    average_execution_time_ms: float
    average_rounds_per_session: float
    total_documents_indexed: int
    most_active_agent: str | None


# ─── Error ─────────────────────────────────────────────────────────────────────
class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    code: str | None = None

